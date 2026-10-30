import {fetchSponsorCatalog,withSponsorOverrides} from '../sponsors/model.js';
import {rotationDefaults,readSponsorPreferences,saveSponsorPreferences} from '../sponsors/rotation.js';
import {resolvePartnerFrame} from './extra-layers.js';
import {hmsBrand} from '/hms-brand.js';
import {loadOrganizationCatalog,organizationFromCatalog} from '../organization-catalog.js';
import {apiGame,parseGameInput,viewUrl,organizations,organizationCatalog,setBroadcastOrganizations} from './hms-source.js';
import {language,translate,localize} from './i18n.js';
import {layers,layerNames,renderMatchLayer} from './match-layers.js';
import {createChannelControl,runChannelView,fitBroadcastCanvas} from './channel.js';
import {mountLibrary,readPublicLibrary} from './library.js';
import {eligibleAssets} from './extra-layers.js';
import {teamPartners,mountPartnerPlaylist} from './partner-playlist.js';
import {broadcastIdentity} from './identity.js';
import {publicOutputUrl} from '../public-output.js';
const SHEET_ID = "12lxrxxyCUwbbFqv93NMNqyhpOUoXbyml00mnNSKGjQ0";
const ASSET_BASE = "https://raw.githubusercontent.com/Wendaar/Youtube-Overlays/main/";
const FRAME = `${ASSET_BASE}PHM_Overlayer_Frame_opnening_smaller.png`;
const BRAND_LOGOS = [
  `${ASSET_BASE}26%2027%20PHM%20Cup%20Season%20Logo.png`,
  `${ASSET_BASE}PHMcup.png`,
  `${ASSET_BASE}PHMlogo.png`,
];

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
let lang=language(params.get('lang'));
const t=value=>translate(value,lang);
document.documentElement.lang=lang;
const mode = params.get("mode") || "control";
broadcastIdentity(mode);
const source=params.get('source')??'hms';
let org=(params.get('org')??'PHM').toUpperCase();
const API_BASE=location.pathname.startsWith('/broadcast/')?'/api/broadcast':'https://hms-insights-five.vercel.app/api/broadcast';
const state = { games: [], teams: [], selectedId: params.get("game"), date: null, preview: "overlay", filter:params.get('filter')??'Today', readAt:null };
state.partnerScope=['organization','team'].includes(params.get('partnerScope'))?params.get('partnerScope'):mode==='control'?'organization':'team';
state.browseIds=null;state.controlError='';state.standingsView=params.get('standingsView')==='full'?'full':'opponents';
Object.assign(state,{corner:['top-left','top-right','bottom-left','bottom-right'].includes(params.get('corner'))?params.get('corner'):'bottom-left',metric:['goals','assists','points'].includes(params.get('metric'))?params.get('metric'):'goals',assetId:params.get('assetId')??'',rotateSeconds:Math.min(300,Math.max(5,Number(params.get('rotateSeconds'))||15)),items:[],rotationIndex:0,partnerSource:params.get('partnerSource')==='hms'||mode==='control'&&params.get('partnerSource')!=='library'?'hms':'library',sponsorCatalog:null});
const savedSponsorDefaults=readSponsorPreferences(org)?.rotation;
state.sponsorRotation={...rotationDefaults,showSeconds:Math.min(300,Math.max(1,Number(params.get('sponsorShow'))||savedSponsorDefaults?.showSeconds||15)),pauseSeconds:Math.min(3600,Math.max(0,params.has('sponsorPause')?Number(params.get('sponsorPause'))||0:savedSponsorDefaults?.pauseSeconds??30)),enabled:params.get('sponsorRotation')==='1',startedAt:Math.max(0,Number(params.get('sponsorStart'))||0)};
// Old permanent channels keep their legacy selection until an operator publishes
// the new explicit playlist. Newly controlled outputs carry this rotation object.
if(mode!=='control'&&!params.has('sponsorRotation'))state.sponsorRotation=null;
let sandbox=false,rotationTimer,contextLoading=false,contextLoaded=false,lastPartnerRead=0,leagueLoading=false,lastLeagueRead=0;
Object.assign(state,{layer:layers.includes(params.get('layer'))?params.get('layer'):'opening',side:['home','away','both'].includes(params.get('side'))?params.get('side'):'home',period:['1','2','3'].includes(params.get('period'))?params.get('period'):'current',page:Math.min(50,Math.max(1,Number.parseInt(params.get('page'),10)||1)),insight:params.get('insight')??''});
let refreshing=false,lastSuccess=0,lastVisual='',pollTimer;
let previewObserver;
const channel=mode==='control'&&source==='hms'?createChannelControl({api:API_BASE,base:location.href,
  getState:()=>({org,gameId:state.selectedId,lang,layer:state.layer,side:state.side,period:state.period,page:state.page,insight:state.insight,corner:state.corner,metric:state.metric,assetId:state.assetId,rotateSeconds:state.rotateSeconds,partnerSource:state.partnerSource,partnerScope:state.partnerScope,standingsView:state.standingsView,sponsorRotation:state.sponsorRotation}),
  onChange:()=>updateChannelPanel()}):null;
function channelMarkup(){
  if(!channel)return '';
  const info=channel.info();
  return `<section class="channel-panel"><h2>${t('Jeden zdroj do OBS')}</h2>
    ${info.bound?`<p>${t('Tuto adresu vložte do OBS jednou. Změny níže se přenesou automaticky.')}</p><input id="channel-url" readonly aria-label="OBS kanál" value="${escapeHtml(info.url)}"><div class="actions"><button class="button" id="copy-channel">${t('Kopírovat stálou OBS adresu')}</button><button class="button primary" id="toggle-channel" ${!info.ready?'disabled':''}>${t(info.visible?'Skrýt v OBS':'Zobrazit v OBS')}</button><button class="button" id="sync-channel">${t('Odeslat aktuální náhled do OBS')}</button></div>`:`<p>${t('Vytvořte jeden kanál a přepínejte jeho obsah z tohoto ovládání.')}</p><button class="button primary" id="create-channel">${t('Vytvořit OBS kanál')}</button>`}
    <p id="channel-status" role="status">${escapeHtml(info.error?t(info.error):info.bound?t(info.pending?'Odesílám do OBS…':info.visible?'V OBS je grafika zapnutá.':'V OBS je grafika skrytá.'):'')}</p>
    ${info.bound?`<small>${t('Ovládání se pamatuje v tomto prohlížeči. Veřejná OBS adresa neumožňuje kanál měnit.')}</small><button class="button" id="copy-control-link">${t('Zálohovat soukromý odkaz k ovládání')}</button>`:''}</section>`;
}
function updateChannelPanel(){
  const slot=document.getElementById('channel-slot');if(!slot)return;slot.innerHTML=channelMarkup();
  const help=document.getElementById('layer-help');if(help&&channel.info().bound)help.textContent=t('Přepínání níže automaticky mění obsah stálého OBS kanálu.');
  const create=document.querySelector('#create-channel');if(create){create.disabled=!selectedGame();create.addEventListener('click',async event=>{event.target.disabled=true;await channel.create();});}
  document.querySelector('#copy-channel')?.addEventListener('click',async()=>{const field=document.querySelector('#channel-url');try{await navigator.clipboard.writeText(field.value);}catch{field.focus();field.select();}});
  document.querySelector('#toggle-channel')?.addEventListener('click',()=>channel.toggle());
  document.querySelector('#copy-control-link')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(channel.controlLink());document.querySelector('#channel-status').textContent=t('Soukromý odkaz zkopírován. Uschovejte si jej; umožňuje měnit výstup.');}catch{document.querySelector('#channel-status').textContent=t('Kopírování není dostupné v tomto prohlížeči.');}});
  const sync=document.querySelector('#sync-channel');if(sync){sync.disabled=!selectedGame();sync.addEventListener('click',async()=>{await channel.init();channel.publish();});}
  const libraryId=channel.info().id;
  const partnerSlot=document.getElementById('partner-slot'),partnerKey=libraryId+':'+channel.info().ready;
  if(partnerSlot&&selectedGame()&&partnerSlot.dataset.binding!==partnerKey){partnerSlot.dataset.binding=partnerKey;mountPartnerPlaylist(partnerSlot,{catalog:state.sponsorCatalog,game:selectedGame(),side:state.side,partnerScope:state.partnerScope,channel,lang,rotation:state.sponsorRotation,onSaved:()=>{state.libraryLoaded='';if(state.sponsorRotation)state.sponsorRotation.startedAt=Date.now();renderControl();channel?.publish();}});}
  if(libraryId&&state.libraryLoaded!==libraryId){
    state.libraryLoaded=libraryId;
    channel.library().then(data=>{state.items=data.items??[];if(['cta','sponsors','announcement'].includes(state.layer))renderControl();}).catch(()=>{state.libraryLoaded='';});
  }
}
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&event.target.classList.contains('sponsor-image'))event.target.remove();},true);
document.body.dataset.org=org;
if(mode==='overlay'||mode==='thumbnail')document.body.className='render-mode';
if(mode==='overlay'&&state.layer!=='opening')fitBroadcastCanvas(app);
function apiUrl(query){const url=new URL(API_BASE,location.origin);url.search=new URLSearchParams({org,...query});return url.href;}
async function apiRequest(query){
  const response=await fetch(apiUrl(query),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(16000)});
  const data=await response.json();if(!response.ok)throw new Error(t(data.error||'HMS data nejsou dostupná.'));
  if(data.org!==org)throw new Error('HMS vrátilo jinou organizaci.');return data;
}
async function loadGame(id){
  const data=await apiRequest({gameId:id,...(mode==='control'||state.layer!=='opening'?{live:'1'}:{})}),game=apiGame(data,org,id);
  game.league??=state.games.find(g=>String(g.ID).toLowerCase()===id.toLowerCase())?.league??null;
  game.context??=state.games.find(g=>String(g.ID).toLowerCase()===id.toLowerCase())?.context??null;
  state.games=[game,...state.games.filter(g=>String(g.ID).toLowerCase()!==id.toLowerCase())];state.selectedId=game.ID;state.readAt=data.readAt;
  if(mode==='control'){const url=new URL(location.href);url.searchParams.set('game',game.ID);history.replaceState(null,'',url);}return game;
}
async function loadContext(game){
  contextLoading=true;
  try{
    const response=await fetch(apiUrl({gameId:game.ID,context:'1'}),{cache:'no-store',signal:AbortSignal.timeout(60000)});
    const data=await response.json();if(!response.ok)throw new Error('Context unavailable');
    const checked=apiGame(data,org,game.ID);game.context=checked.context??{historyAvailable:false,nextAvailable:false};
  }catch{game.context={historyAvailable:false,nextAvailable:false};}
  finally{contextLoading=false;contextLoaded=true;const current=selectedGame();if(current)current.context=game.context;renderOverlay(current??game);setTimeout(()=>{contextLoaded=false;},120000);}
}
async function loadLeague(game){
  leagueLoading=true;lastLeagueRead=Date.now();
  try{const data=await apiRequest({gameId:game.ID,league:'1'});game.league=apiGame(data,org,game.ID).league??{standingsAvailable:false,leadersAvailable:false};}
  catch{game.league={standingsAvailable:false,leadersAvailable:false};}
  finally{leagueLoading=false;const current=selectedGame();if(current?.ID===game.ID)current.league=game.league;if(mode==='overlay')renderOverlay(current??game);else renderControl();}
}
async function loadPartners(){
  lastPartnerRead=Date.now();
  try{const data=withSponsorOverrides(await fetchSponsorCatalog(org));if(!Array.isArray(data.items)||!Array.isArray(data.bindings))throw new Error();state.sponsorCatalog=data;}catch{state.sponsorCatalog=null;}
}
async function loadDay(){
  const data=await apiRequest({filter:state.filter});
  const games=data.items.map(item=>({ID:item.gameId,Date:item.playedOn?.split('-').reverse().join('. ')??'',DateISO:item.playedOn,Time:item.startTime?.slice(0,5)??'',
    'Home Team':item.home.name??'Domácí tým · podrobnosti po výběru','Away Team':item.away.name??'Hosté · podrobnosti po výběru',Group:org,Venue:'Podrobnosti po výběru zápasu',warnings:[],_thin:true,_labelsAvailable:!!(item.home.name&&item.away.name)}));
  const detailed=new Map(state.games.filter(g=>!g._thin).map(g=>[g.ID.toLowerCase(),g]));
  const selected=selectedGame();
  state.games=games.map(g=>detailed.get(g.ID.toLowerCase())??g);
  if(selected&&!state.games.some(g=>g.ID.toLowerCase()===selected.ID.toLowerCase()))state.games.unshift(selected);
  state.browseIds=games.map(g=>g.ID.toLowerCase());
  state.hasMore=data.hasMore;
}
function renderUrl(view,game,clean=false){return viewUrl(location.href,{mode:view,org,gameId:game.ID,source,clean,lang,...state,library:channel?.info().id??params.get('library')??''});}
function languageControl(){return `<label class="language-control">${t('Jazyk')}<select id="language"><option value="cs" ${lang==='cs'?'selected':''}>CZ</option><option value="en" ${lang==='en'?'selected':''}>EN</option></select></label>`;}
function layerControls(game){
  const option=(value,label,current)=>`<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(t(label))}</option>`;
  const m=game.match;
  const partnerLayer=['sponsors','announcement'].includes(state.layer);
  const partnerOptions=partnerLayer&&state.partnerSource==='hms'?teamPartners(state.sponsorCatalog,game,state.side,state.items,state.partnerScope):eligibleAssets(state.items,{org,gameId:game.ID,homeId:game.homeId,awayId:game.awayId,side:state.side,kind:state.layer==='cta'?'cta':'sponsor'});
  const size=state.side==='both'?12:20;
  const count=state.layer==='lineup'?Math.max(...['home','away'].filter(s=>state.side==='both'||s===state.side).map(s=>m?.roster.filter(p=>p.side===s).length??0)):m?.goals.filter(g=>state.side==='both'||g.side===state.side).length??0;
  const pages=state.layer==='standings'?Math.max(1,Math.ceil((game.league?.standings?.length??0)/8)):Math.max(1,Math.ceil(count/(state.layer==='lineup'?size:8)));
  return `<section class="layer-controls"><label>${t('Vrstva')}<select id="layer">${layers.map(l=>option(l,layerNames[l],state.layer)).join('')}</select></label>
    ${['lineup','scoresheet'].includes(state.layer)?`<label>${t('Tým')}<select id="layer-side">${[['home','Domácí'],['away','Hosté'],['both','Oba týmy']].map(([v,l])=>option(v,l,state.side)).join('')}</select></label><label>${t('Strana')}<select id="layer-page">${Array.from({length:pages},(_,i)=>option(String(i+1),String(i+1),String(state.page))).join('')}</select></label>`:''}
    ${state.layer==='periods'?`<label>${t('Třetina / stav')}<select id="layer-period">${[['current','Aktuální / konečný stav'],['1','Po 1. třetině'],['2','Po 2. třetině'],['3','Po 3. třetině']].map(([v,l])=>option(v,l,state.period)).join('')}</select></label>`:''}
    ${state.layer==='insights'?`<label>${t('Insight')}<select id="layer-insight">${m?.insights.length?m.insights.map(i=>option(i.id,`${i.name} · ${t(i.type==='hat-trick'?'Hattrick':'Vícebodový zápas')}`,state.insight)).join(''):option('','Žádný dostupný insight','')}</select></label>`:''}
    ${(['powerplay','leaders','leaders-strip','next','results','cta'].includes(state.layer)||partnerLayer&&(state.partnerSource!=='hms'||state.partnerScope==='team'))?`<label>${t('Tým')}<select id="layer-side">${[['home',game['Home Team']],['away',game['Away Team']],...(state.layer==='cta'||state.layer==='sponsors'&&state.partnerSource==='library'?[['both','Oba týmy']]:[])].map(([v,l])=>option(v,l,state.side)).join('')}</select></label>`:''}
    ${['leaders','leaders-strip'].includes(state.layer)?`<label>${t('Statistika')}<select id="layer-metric">${[['points','Body'],['goals','Góly'],['assists','Asistence']].map(([v,l])=>option(v,l,state.metric)).join('')}</select></label>`:''}
    ${state.layer==='standings'?`<label>${t('Rozsah tabulky')}<select id="standings-view">${[['opponents','Oba soupeři · skutečné pořadí'],['full','Celá tabulka · po stránkách']].map(([v,l])=>option(v,l,state.standingsView)).join('')}</select></label>${state.standingsView==='full'?`<label>${t('Strana')}<select id="layer-page">${Array.from({length:pages},(_,i)=>option(String(i+1),String(i+1),String(state.page))).join('')}</select></label>`:''}`:''}
    ${['cta','sponsors','powerplay','leaders-strip','standings'].includes(state.layer)?`<label>${t('Umístění')}<select id="layer-corner">${[['top-left','Vlevo nahoře'],['top-right','Vpravo nahoře'],['bottom-left','Vlevo dole'],['bottom-right','Vpravo dole']].map(([v,l])=>option(v,l,state.corner)).join('')}</select></label>`:''}
    ${['cta','sponsors','announcement'].includes(state.layer)?`<label>${t('Položka')}<select id="layer-asset">${option('','Střídat všechny odpovídající',state.assetId)}${partnerOptions.map(a=>option(a.id,a.title,state.assetId)).join('')}</select></label>${state.layer==='cta'?`<label>${t('Střídat každých (sekund)')}<select id="layer-rotation">${[5,10,15,30,60,120,300].map(v=>option(String(v),String(v),String(state.rotateSeconds))).join('')}</select></label>`:''}`:''}
    ${partnerLayer?`<label>${t('Logo (s)')}<input id="sponsor-show" type="number" min="1" max="300" value="${state.sponsorRotation.showSeconds}"></label><label>${t('Pauza bez loga (s)')}<input id="sponsor-pause" type="number" min="0" max="3600" value="${state.sponsorRotation.pauseSeconds}"></label><label>${t('Rotace partnerů')}<select id="sponsor-rotation">${option('0','Zastavená · držet vybraného',state.sponsorRotation.enabled?'1':'0')}${option('1','Spustit automatickou rotaci',state.sponsorRotation.enabled?'1':'0')}</select></label>`:''}
    ${state.layer==='powerplay'?`<p>${t('Vyberte tým, který hraje přesilovku. PP patří tomuto týmu, PK soupeři. Zapnutí vrstvy je ruční, bez živé časomíry.')}</p>`:''}
    ${partnerLayer&&state.partnerSource==='hms'?`<label>${t('Partneři')}<select id="partner-scope">${[['organization','Celá organizace'],['team','Vybraný tým']].map(([v,l])=>option(v,l,state.partnerScope)).join('')}</select></label>`:''}
    ${partnerLayer?`<label>${t('Zdroj partnerů')}<select id="partner-source">${[['hms','Centrální katalog HMS'],['library','Doplňky pouze pro tento kanál']].map(([v,l])=>option(v,l,state.partnerSource)).join('')}</select></label>`:''}
    ${state.layer==='cta'?`<p>${t('Centrální QR soubory zatím HMS API neposkytuje. Zde vybíráte hotové QR z doplňků tohoto kanálu; logo partnera se za QR nezaměňuje.')}</p>`:''}
    <p id="layer-help">${t(channel?.info().bound?'Přepínání níže automaticky mění obsah stálého OBS kanálu.':'Výběr vrstvy mění náhled a kopírovanou adresu. V OBS použijte adresu dané vrstvy.')}</p></section>${partnerLayer&&state.partnerSource==='hms'?'<section class="partner-panel" id="partner-slot"></section>':''}`;
}
function connectionMarkup(){return `<section class="connection-bar"><form id="game-form"><label>Organizace<select id="org">${organizations.includes(org)?'':'<option value="">—</option>'}${organizationCatalog.map(o=>`<option value="${escapeHtml(o.code)}" ${o.code===org?'selected':''}>${escapeHtml(o.name)}${o.configured?'':' · '+(lang==='en'?'Not connected':'Nepřipojeno')}</option>`).join('')}</select></label><label class="game-input-label">Odkaz na zápas v HMS nebo Game ID<input id="game-input" value="${escapeHtml(state.selectedId??'')}" placeholder="https://prod.hms.wootera.net/org/euchl/games/…" required></label><button class="button primary" data-hms-refresh>Načíst zápas</button></form><div class="browse-dates">${[['Today','Dnes'],['Tomorrow','Zítra'],['+7 days','Příštích 7 dnů'],['Past','Minulé zápasy']].map(([id,label])=>`<button class="button ${state.filter===id?'primary':''}" data-filter="${id}">${label}</button>`).join('')}<button class="button" id="refresh-data">Obnovit z HMS</button></div><p id="connection-status" role="status">${source==='sheet'?'Původní PHM Sheet · kompatibilní režim':`HMS API · ${org} · ${state.readAt?'načteno '+escapeHtml(new Date(state.readAt).toLocaleTimeString('cs-CZ')):'vyberte zápas'}${state.hasMore?' · zobrazeno prvních 20 zápasů, další otevřete odkazem':''}`}</p></section>`;}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function norm(value) {
  return String(value || "").trim().toLocaleLowerCase("cs-CZ").replace(/\s+/g, " ");
}

function cellValue(cell) {
  if (!cell) return "";
  if (cell.f !== undefined && cell.f !== null) return cell.f;
  if (cell.v === undefined || cell.v === null) return "";
  return cell.v;
}

function loadSheet(sheet) {
  return new Promise((resolve, reject) => {
    const callback = `phm_${sheet.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => finish(new Error(`List ${sheet} se nepodařilo načíst.`)), 15000);
    function finish(error, value) {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(value);
    }
    window[callback] = (payload) => {
      if (!payload?.table) return finish(new Error(`List ${sheet} neobsahuje tabulku.`));
      const headers = payload.table.cols.map((column, index) => column.label || column.id || `col_${index}`);
      const rows = payload.table.rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, cellValue(row.c[index])])));
      finish(null, rows);
    };
    script.onerror = () => finish(new Error(`List ${sheet} se nepodařilo načíst.`));
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${callback}&sheet=${encodeURIComponent(sheet)}`;
    document.head.appendChild(script);
  });
}

function findTeam(name) {
  if (!name) return { team: null, warning: "Název týmu zatím není vyplněný." };
  const fields = ["Nick", "Name", "Short"];
  for (const field of fields) {
    const matches = state.teams.filter((team) => norm(team[field]) === norm(name));
    if (matches.length) {
      return {
        team: matches[0],
        warning: matches.length > 1 ? `Název „${name}“ odpovídá více týmům; použito je první nalezené logo.` : "",
      };
    }
  }
  return { team: null, warning: `Pro tým „${name}“ nebylo v Teams nalezeno logo.` };
}

function gameModel(game) {
  if(source==='hms')return game;
  const home = findTeam(game["Home Team"]);
  const away = findTeam(game["Away Team"]);
  return {
    ...game,
    homeLogo: home.team?.["Logo (Medium)"] || "",
    awayLogo: away.team?.["Logo (Medium)"] || "",
    warnings: [home.warning, away.warning, !game.Timekeeper ? "Není vyplněný časoměřič." : "", !game.Referee ? "Není vyplněný rozhodčí." : ""].filter(Boolean),
  };
}

function selectedGame() {
  const raw = state.games.find((game) => String(game.ID).toLowerCase() === String(state.selectedId).toLowerCase());
  return raw&&!raw._thin ? gameModel(raw) : null;
}

function logoMarkup(src, className, alt) {
  return src
    ? `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="eager" />`
    : (org==='PHM'?`<img class="${className}" src="${BRAND_LOGOS[2]}" alt="" aria-hidden="true" style="opacity:.22" crossorigin="anonymous" />`:`<span class="${className} missing-logo" aria-label="Logo není dostupné">${escapeHtml(alt.replace(/^Logo /,''))}</span>`);
}

function renderStatus(message, error = false) {
  if(mode==='overlay') {document.body.dataset.connection=error?'error':'loading';app.replaceChildren();console.warn(message);return;}
  app.innerHTML = `<main class="status-screen"><div>${error ? "" : '<div class="spinner"></div>'}<h1>${escapeHtml(message)}</h1>${error ? '<p>Ověřte organizaci, odkaz na zápas a připojení HMS. Při výpadku se žádný jiný zápas automaticky nevybere.</p><a href="index.html?org='+encodeURIComponent(org)+'">Zpět do ovládání</a>' : ""}</div></main>`;
  localize(app,lang);
}

function renderBrandRotator() {
  if(org!=='PHM'){
    const logos=selectedGame()?.brandLogos??[];
    return logos.length?`<div class="brand-rotator hms-brand">${logos.map(src=>`<img src="${escapeHtml(src)}" alt="${escapeHtml(org)}" />`).join('')}</div>`:`<div class="brand-rotator text-brand">${escapeHtml(org)}</div>`;
  }
  return `<div class="brand-rotator" aria-label="PHM Cup"><img src="${BRAND_LOGOS[0]}" alt="Logo 10. sezony PHM Cup" /><img src="${BRAND_LOGOS[1]}" alt="Logo PHM Cup" /><img src="${BRAND_LOGOS[2]}" alt="Logo PHM" /></div>`;
}

function frameMarkup(){
  if(org==='PHM')return `<img class="frame-art" src="${FRAME}" alt="" aria-hidden="true" />`;
  return `<svg class="frame-art neutral-frame" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="lines" width="100" height="30" patternUnits="userSpaceOnUse"><path d="M0 26H70" stroke="#00d7e6" stroke-opacity=".13"/></pattern></defs><path fill="#071a22" fill-opacity=".95" stroke="#00d7e6" stroke-opacity=".4" stroke-width="2" d="M210 155H1010L1135 280L1010 415H210Z M1710 445H910L785 580L910 730H1710Z M250 765H1670V920H250Z"/><path fill="url(#lines)" d="M210 155H1010L1135 280L1010 415H210Z M1710 445H910L785 580L910 730H1710Z"/><path fill="none" stroke="#00d7e6" stroke-opacity=".45" stroke-width="3" d="M60 100V50H260 M1660 50H1860V100 M60 980V1030H260 M1660 1030H1860V980"/></svg>`;
}

function renderOverlay(game) {
  document.body.className = "render-mode";
  if(state.layer!=='opening'){
    const sameLayer=app.querySelector('[data-layer]')?.dataset.layer===state.layer;
    app.innerHTML=renderMatchLayer(game,{...state,org,lang});if(sameLayer)app.querySelector('.slide-panel')?.classList.add('is-update');
    if(['leaders','leaders-strip','standings'].includes(state.layer)&&!leagueLoading&&(!game.league||Date.now()-lastLeagueRead>=60000))loadLeague(game);
    if(['powerplay','next','results'].includes(state.layer)&&!contextLoading&&!contextLoaded)loadContext(game);
    if(['sponsors','announcement'].includes(state.layer)&&state.sponsorRotation){
      clearInterval(rotationTimer);let last='';
      const paint=()=>{const current=selectedGame()??game,settings={...state,org,lang},frame=resolvePartnerFrame(current,settings);const html=renderMatchLayer(current,{...settings,partnerFrame:frame});if(html!==last||!app.firstElementChild&&html){app.innerHTML=html;last=html;}const el=app.querySelector('[data-sponsor-layer]');if(el)el.style.opacity=String(frame.opacity);};
      paint();rotationTimer=setInterval(paint,100);
    }else if(['cta','sponsors','announcement'].includes(state.layer)&&!rotationTimer)rotationTimer=setInterval(()=>{state.rotationIndex++;app.innerHTML=renderMatchLayer(selectedGame()??game,{...state,org,lang});},state.rotateSeconds*1000);
    return;
  }
  const homeName = game["Home Team"] || "Bude doplněno";
  const awayName = game["Away Team"] || "Bude doplněno";
  app.innerHTML = `
    <main class="stage overlay-stage" aria-label="Opening overlay ${escapeHtml(homeName)} versus ${escapeHtml(awayName)}">
      ${frameMarkup()}
      ${renderBrandRotator()}
      <section class="team-block home">
        ${logoMarkup(game.homeLogo, "team-logo", `Logo ${homeName}`)}
        <div class="team-copy"><div class="team-side">Domácí</div><div class="team-name ${game["Home Team"] ? "" : "placeholder-name"}">${escapeHtml(homeName)}</div></div>
      </section>
      <section class="team-block away">
        ${logoMarkup(game.awayLogo, "team-logo", `Logo ${awayName}`)}
        <div class="team-copy"><div class="team-side">Hosté</div><div class="team-name ${game["Away Team"] ? "" : "placeholder-name"}">${escapeHtml(awayName)}</div></div>
      </section>
      <section class="info-strip">
        <div class="info-cell time-cell"><div class="info-label">Čas</div><div class="game-time">${escapeHtml(game.Time || "--:--")}</div></div>
        <div class="info-cell"><div class="info-label">Datum</div><div class="info-value">${escapeHtml(game.Date || "Bude doplněno")}</div></div>
        <div class="info-cell venue-cell"><div class="info-label">Místo</div><div class="info-value">${escapeHtml(game.Venue || "Bude doplněno")}</div><div class="info-subvalue">${escapeHtml([game.Competition, game.Group].filter(Boolean).join(" · ") || org)}</div></div>
        <div class="info-cell"><div class="info-label">Rozhodčí</div><div class="info-value official-value">${escapeHtml(game.Referee || "Bude doplněno")}</div></div>
        <div class="info-cell"><div class="info-label">Časoměřič</div><div class="info-value official-value">${escapeHtml(game.Timekeeper || "Bude doplněno")}</div></div>
      </section>
    </main>`;
  localize(app,lang);
}

function renderThumbnail(game) {
  document.body.className = "render-mode";
  document.documentElement.style.setProperty("--frame-url", org==='PHM'?`url("${FRAME}")`:'none');
  const homeName = game["Home Team"] || "Bude doplněno";
  const awayName = game["Away Team"] || "Bude doplněno";
  app.innerHTML = `
    <main id="thumbnail" class="stage thumbnail-stage" aria-label="YouTube miniatura ${escapeHtml(homeName)} versus ${escapeHtml(awayName)}">
      <div class="thumbnail-kicker">${escapeHtml([game.Competition || org, game.Group].filter(Boolean).join(" · "))}</div>
      <section class="thumbnail-matchup">
        <div class="thumb-team">${logoMarkup(game.homeLogo, "thumb-logo", `Logo ${homeName}`)}<div class="thumb-name">${escapeHtml(homeName)}</div></div>
        <div class="versus">VS</div>
        <div class="thumb-team">${logoMarkup(game.awayLogo, "thumb-logo", `Logo ${awayName}`)}<div class="thumb-name">${escapeHtml(awayName)}</div></div>
      </section>
      <footer class="thumbnail-footer">
        <div><div class="thumb-time">${escapeHtml(game.Time || "--:--")}</div><div class="thumb-meta">${escapeHtml(game.Date || "Datum bude doplněno")} · ${escapeHtml(game.Venue || "Místo bude doplněno")}</div></div>
        ${org==='PHM'?`<img class="thumb-brand" src="${BRAND_LOGOS[0]}" alt="PHM Cup" crossorigin="anonymous" />`:`<div class="thumb-wordmark">${escapeHtml(org)}</div>`}
      </footer>
    </main>
    ${params.get("clean") === "1" ? "" : '<button class="download-floating" id="download-thumbnail">Stáhnout PNG</button>'}`;
  document.querySelector("#download-thumbnail")?.addEventListener("click", downloadThumbnail);
  localize(app,lang);
}

async function downloadThumbnail() {
  const button = document.querySelector("#download-thumbnail");
  const original = button?.textContent;
  if(button){button.textContent = "Připravuji…";button.disabled = true;}
  try {
    if (!window.html2canvas) throw new Error("Nástroj pro export není načtený.");
    const canvas = await html2canvas(document.querySelector("#thumbnail"), { width: innerWidth, height: innerHeight, scale: 1280 / innerWidth, useCORS: true, backgroundColor: "#061115", logging: false });
    const link = document.createElement("a");
    link.download = `${org}-${norm(selectedGame()?.Name || "thumbnail").replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    alert(`Miniaturu se nepodařilo stáhnout: ${error.message}`);
  } finally {
    if(button){button.textContent = original;button.disabled = false;}
  }
}
window.downloadThumbnail=downloadThumbnail;

function renderControl() {
  document.body.className = "";
  const listed=state.browseIds===null?state.games:state.games.filter(g=>state.browseIds.includes(g.ID.toLowerCase()));
  const dates = [...new Set(listed.map((game) => game.Date || "Bez data"))];
  if(!dates.includes(state.date))state.date=dates[0];
  const dayGames = listed.filter((game) => (game.Date || "Bez data") === state.date);
  const game = selectedGame();
  const previewUrl = game?renderUrl(state.preview,game,state.preview==='thumbnail'):'';
  const obsUrl = game?(sandbox?renderUrl('overlay',game):publicOutputUrl(renderUrl('overlay',game))):'';
  app.innerHTML = `
    <div class="control-shell">
      <header class="control-header">
        ${hmsBrand()}<div class="brand-lockup">${org==='PHM'?`<img class="brand-mark" src="${BRAND_LOGOS[1]}" alt="PHM Cup" />`:`<strong class="brand-wordmark">${escapeHtml(org)}</strong>`}<div><p class="eyebrow">Broadcast graphics</p><h1>Broadcast Studio</h1></div></div>
        ${languageControl()}<div class="live-chip">${source==='hms'?'HMS API · '+escapeHtml(org):'Původní Google Sheet'}</div>
      </header>
      ${sandbox?`<div class="preview-notice">${t('TESTOVACÍ VERZE · oddělené OBS kanály. Dnešní přenos používejte z dosavadní produkce.')} <a href="demo.html" target="_blank">${t('Prohlédnout ukázky nových vrstev')}</a></div>`:''}
      ${connectionMarkup()}
      <div class="control-grid">
        <aside class="match-panel">
          <div class="panel-title"><h2>Vyber zápas</h2><span class="count">${listed.length} zápasů</span></div>
          <div class="date-tabs">${dates.map((date) => `<button class="date-tab ${date === state.date ? "active" : ""}" data-date="${escapeHtml(date)}">${escapeHtml(date)}</button>`).join("")}</div>
          <div class="match-list">${dayGames.map((item) => { const model = gameModel(item); return `<button class="match-card ${String(item.ID) === String(game?.ID) ? "active" : ""}" data-game="${escapeHtml(item.ID)}"><div class="match-card-top"><span>${escapeHtml(item.Time || "--:--")}</span><span>${escapeHtml(item.Group || "PHM Cup")}${model.warnings.length ? '<i class="warn-dot" title="Chybějící nebo nejednoznačná data"></i>' : ""}</span></div><div class="match-card-teams">${escapeHtml(item["Home Team"] || "Bude doplněno")} — ${escapeHtml(item["Away Team"] || "Bude doplněno")}</div><div class="match-card-venue">${escapeHtml(item.Venue || "Místo bude doplněno")}</div></button>`; }).join("")}</div>
        </aside>
        <main class="workspace">
          <div id="channel-slot"></div>
          <section class="partner-panel catalog-source"><h2>${t('Centrální katalog partnerů')}</h2><p>${t('Stejný seznam jako v přehledu sponzorů. Loga, claimy, weby a přiřazení týmům spravujte v HMS. Ve Studiu vybíráte formát, partnery a pořadí zobrazení.')}</p><a class="button" href="/sponsors?org=${encodeURIComponent(org)}" target="_blank" rel="noopener">${t('Otevřít společný katalog')}</a></section>
          <details class="library-panel"><summary>${t('Doplňky pro tento kanál · vlastní QR nebo mimořádný partner')}</summary><div id="library-slot"></div></details>
          ${!game?`<p class="data-alert">${t('Vyberte zápas ze seznamu nebo vložte jeho HMS odkaz. Přepnutí období nemění výstup v OBS.')}</p>`:`
          ${source==='hms'?layerControls(game):''}
          <div class="workspace-toolbar">
            <div class="view-switch"><button class="view-button ${state.preview === "overlay" ? "active" : ""}" data-view="overlay">OBS overlay</button><button class="view-button ${state.preview === "thumbnail" ? "active" : ""}" data-view="thumbnail">YouTube miniatura</button></div>
            <div class="actions"><button class="button" id="copy-url">Kopírovat OBS URL</button><button class="button" id="open-view">Otevřít čistý náhled</button>${state.preview === "thumbnail" ? '<button class="button primary" id="download-from-control">Stáhnout PNG</button>' : ""}</div>
          </div>
          <div class="obs-url-bar"><div><span>Unikátní OBS URL vybraného zápasu</span><strong>${escapeHtml(game.Name || game.ID)}</strong></div><input id="current-obs-url" readonly value="${escapeHtml(obsUrl)}" aria-label="Unikátní OBS URL vybraného zápasu" /></div>
          <section class="preview-card">
            <div class="preview-meta"><span>${escapeHtml(game.Name || `${game["Home Team"] || "?"} vs ${game["Away Team"] || "?"}`)}</span><span>${state.preview === "overlay" ? "1920 × 1080 · transparentní" : "1280 × 720"}</span></div>
            <div class="preview-frame ${state.preview === "overlay" ? "overlay-preview" : ""}"><iframe id="preview" title="Náhled grafiky" src="${previewUrl}"></iframe></div>
            ${game.warnings.length ? `<div class="data-alert"><strong>Upozornění k datům:</strong> ${game.warnings.map(escapeHtml).join(" ")}</div>` : ""}
          </section>`}
        </main>
      </div>
    </div>`;
  wireControl();
}

function wireControl() {
  updateChannelPanel();
  const leagueGame=selectedGame();if(leagueGame&&['leaders','leaders-strip','standings'].includes(state.layer)&&!leagueLoading&&(!leagueGame.league||Date.now()-lastLeagueRead>=60000))loadLeague(leagueGame);
  document.querySelector('.library-panel')?.addEventListener('toggle',event=>{if(event.target.open){mountLibrary(document.getElementById('library-slot'),{channel,org,game:selectedGame(),lang,onSaved:()=>{state.libraryLoaded='';renderControl();}});}});
  localize(app,lang);
  if(state.controlError)document.querySelector('#connection-status').textContent=t(state.controlError);
  document.querySelector('#language')?.addEventListener('change',event=>{lang=language(event.target.value);document.documentElement.lang=lang;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);renderControl();if(selectedGame())channel?.publish();});
  for(const id of ['sponsor-show','sponsor-pause','sponsor-rotation'])document.getElementById(id)?.addEventListener('change',event=>{
    const input=event.target;if(!input.checkValidity())return;
    const r=state.sponsorRotation;
    if(id==='sponsor-show')r.showSeconds=Number(input.value);else if(id==='sponsor-pause')r.pauseSeconds=Number(input.value);else r.enabled=input.value==='1';
    r.startedAt=Date.now();const saved=readSponsorPreferences(org)??{choices:[]};
    saveSponsorPreferences(org,'organization','',{...saved,rotation:{...r,enabled:false,startedAt:0}});
    const url=new URL(location.href);for(const [key,value] of Object.entries({sponsorRotation:r.enabled?'1':'0',sponsorShow:r.showSeconds,sponsorPause:r.pauseSeconds,sponsorStart:r.startedAt}))url.searchParams.set(key,String(value));history.replaceState(null,'',url);renderControl();channel?.publish();
  });
  const settings={layer:'layer','layer-side':'side','layer-period':'period','layer-page':'page','layer-insight':'insight','layer-corner':'corner','layer-metric':'metric','layer-asset':'assetId','layer-rotation':'rotateSeconds','partner-source':'partnerSource','partner-scope':'partnerScope','standings-view':'standingsView'};
  for(const [id,key] of Object.entries(settings))document.getElementById(id)?.addEventListener('change',event=>{
    state[key]=['page','rotateSeconds'].includes(key)?Number(event.target.value):event.target.value;
    if(key==='layer'||key==='side'||key==='standingsView')state.page=1;
    if(key==='layer'&&state.layer==='leaders-strip')state.metric='points';
    if(['leaders','leaders-strip','standings'].includes(state.layer)&&selectedGame()&&!selectedGame().league&&!leagueLoading)loadLeague(selectedGame());
    if(key==='layer'||key==='side'||key==='partnerSource'||key==='partnerScope')state.assetId='';
    if((['powerplay','leaders','leaders-strip','next','results','announcement'].includes(state.layer)||state.layer==='sponsors'&&state.partnerSource==='hms')&&state.side==='both')state.side='home';
    const url=new URL(location.href);for(const k of ['layer','side','period','page','insight','corner','metric','assetId','rotateSeconds','partnerSource','partnerScope','standingsView'])url.searchParams.set(k,state[k]);history.replaceState(null,'',url);renderControl();channel?.publish();
  });
  previewObserver?.disconnect();
  const previewBox=document.querySelector('.preview-frame');
  if(previewBox){
    const resize=()=>previewBox.style.setProperty('--preview-scale',String(previewBox.clientWidth/1920));
    resize();previewObserver=new ResizeObserver(resize);previewObserver.observe(previewBox);
  }
  document.querySelector('#game-form')?.addEventListener('submit',event=>{
    event.preventDefault();const status=document.querySelector('#connection-status');
    try{const input=parseGameInput(document.querySelector('#game-input').value,document.querySelector('#org').value);const url=new URL(location.href);url.search=new URLSearchParams({org:input.org,game:input.gameId,source:'hms',lang});sessionStorage.setItem('hms-obs-publish-on-load','1');location.assign(url);}
    catch(error){status.textContent=t(error.message);}
  });
  document.querySelector('#org')?.addEventListener('change',event=>{const url=new URL(location.href);url.search=new URLSearchParams({org:event.target.value,source:'hms',lang});location.assign(url);});
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=async()=>{
    if(state.browsing)return;state.browsing=true;state.filter=button.dataset.filter;state.controlError='';
    const url=new URL(location.href);url.searchParams.set('filter',state.filter);history.replaceState(null,'',url);
    document.querySelector('#connection-status').textContent=t('Načítám zápasy…');
    try{await loadDay();}catch{state.controlError='Seznam zápasů se nepodařilo načíst. Zkuste Obnovit z HMS nebo vložte odkaz na zápas.';}
    finally{state.browsing=false;renderControl();}
  });
  document.querySelector('#refresh-data')?.addEventListener('click',async()=>{
    const status=document.querySelector('#connection-status');status.textContent=t('Obnovuji data z HMS…');
    state.controlError='';
    lastLeagueRead=0;
    await loadPartners();
    if(state.selectedId)try{await loadGame(state.selectedId);}catch(error){state.controlError=error.message;}
    try{await loadDay();}catch{state.controlError='Seznam zápasů se nepodařilo načíst. Zkuste Obnovit z HMS nebo vložte odkaz na zápas.';}renderControl();
  });
  document.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => { state.date = button.dataset.date; renderControl(); }));
  document.querySelectorAll("[data-game]").forEach((button) => button.addEventListener("click", async () => {
    const previous=state.selectedId;button.disabled=true;
    try{if(source==='hms')await loadGame(button.dataset.game);else state.selectedId=button.dataset.game;state.controlError='';state.page=1;state.insight='';const controlUrl=new URL(location.href);controlUrl.searchParams.set('game',state.selectedId);controlUrl.searchParams.set('page','1');controlUrl.searchParams.delete('insight');history.replaceState(null,'',controlUrl);renderControl();channel?.publish();}
    catch(error){state.selectedId=previous;document.querySelector('#connection-status').textContent=t(error.message);button.disabled=false;}
  }));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.preview = button.dataset.view; renderControl(); }));
  document.querySelector("#open-view")?.addEventListener("click", () => { const game = selectedGame(); window.open(sandbox?renderUrl(state.preview,game,true):publicOutputUrl(renderUrl(state.preview,game,true)), "_blank", "noopener"); });
  document.querySelector("#copy-url")?.addEventListener("click", async () => { const field = document.querySelector("#current-obs-url"); const button = document.querySelector("#copy-url"); try { await navigator.clipboard.writeText(field.value); button.textContent = t("URL zkopírována"); } catch { field.focus(); field.select(); document.execCommand("copy"); button.textContent = t("URL označena"); } setTimeout(() => button.textContent = t("Kopírovat OBS URL"), 1400); });
  document.querySelector("#download-from-control")?.addEventListener("click", () => { const frame = document.querySelector("#preview"); frame.contentWindow.downloadThumbnail?.(); });
}

async function refreshRenderMode() {
  if(refreshing)return;refreshing=true;
  try {
    if(source==='hms')await loadGame(state.selectedId);
    else [state.games,state.teams]=await Promise.all([loadSheet('Games'),loadSheet('Teams')]);
    const game = selectedGame();
    if (!game) throw new Error('Vybraný zápas nebyl nalezen.');
    if(['sponsors','announcement'].includes(state.layer)&&state.partnerSource==='hms'&&Date.now()-lastPartnerRead>=60000)await loadPartners();
    if(['leaders','leaders-strip','standings'].includes(state.layer)&&!leagueLoading&&Date.now()-lastLeagueRead>=60000)loadLeague(game);
    const visual=JSON.stringify(game)+(['sponsors','announcement'].includes(state.layer)?JSON.stringify(state.sponsorCatalog):'');lastSuccess=Date.now();document.body.dataset.connection='ok';
    if(mode==='overlay'&&['powerplay','leaders','next','results'].includes(state.layer)&&!contextLoading&&!contextLoaded)loadContext(game);
    if(visual!==lastVisual){if(mode==='overlay')renderOverlay(game);if(mode==='thumbnail')renderThumbnail(game);lastVisual=visual;}
  } catch (error) {
    document.body.dataset.connection='stale';console.warn('Automatická aktualizace dat se nezdařila.');
    if(mode==='overlay'&&(!lastSuccess||Date.now()-lastSuccess>(state.layer==='opening'?600000:60000)))app.replaceChildren();
  }finally{refreshing=false;clearTimeout(pollTimer);pollTimer=setTimeout(refreshRenderMode,document.body.dataset.connection==='ok'?(state.layer==='opening'?60000:15000):15000);}
}

async function start() {
  renderStatus("Načítám zápasy…");
  if(mode==='control')try{const response=await fetch(apiUrl({capabilities:'1'}));sandbox=(await response.json()).sandbox===true;}catch{}
  try {
    setBroadcastOrganizations(await loadOrganizationCatalog());
    org=organizationFromCatalog(organizationCatalog,params.get('org')??'PHM')?.code??'';
    document.body.dataset.org=org;
    if(!organizations.includes(org)||!['hms','sheet'].includes(source)||source==='sheet'&&org!=='PHM')throw new Error('Neplatná organizace nebo zdroj dat.');
    if(source==='hms'){
      if(!organizationFromCatalog(organizationCatalog,org)?.configured)throw new Error(lang==='en'?'This organization has no data connection yet.':'Organizace zatím nemá nastavené datové připojení.');
      if(state.selectedId){parseGameInput(state.selectedId,org);await loadGame(state.selectedId);}
      else if(mode==='overlay'||mode==='thumbnail')throw new Error('V OBS URL chybí Game ID.');
      else{await loadDay();const first=state.games.find(g=>g._labelsAvailable);if(first)await loadGame(first.ID);}
    }else{
      [state.games,state.teams]=await Promise.all([loadSheet('Games'),loadSheet('Teams')]);
      if(!state.games.length)throw new Error('List Games je prázdný.');state.selectedId ||=state.games[0].ID;
    }
    if(source==='hms'&&(mode==='control'||['sponsors','announcement'].includes(state.layer)&&state.partnerSource==='hms'))await loadPartners();
    if(mode==='overlay'&&params.get('library'))try{state.items=await readPublicLibrary(API_BASE,params.get('library'));}catch{}
    const game = selectedGame();
    if (!game&&mode!=='control') throw new Error("Vybraný zápas nebyl nalezen.");
    lastSuccess=Date.now();lastVisual=JSON.stringify(game);document.body.dataset.connection='ok';
    if (mode === "overlay") renderOverlay(game);
    else if (mode === "thumbnail") renderThumbnail(game);
    else renderControl();
    if(channel){await channel.init();if(sessionStorage.getItem('hms-obs-publish-on-load')==='1'){sessionStorage.removeItem('hms-obs-publish-on-load');channel.publish();}}
    if(mode==='control'&&source==='hms'&&params.has('game'))loadDay().then(()=>renderControl()).catch(()=>{
      state.listWarning=true;const notice=document.querySelector('#connection-status');if(notice)notice.textContent=t('Vybraný zápas je načtený. Seznam dalších zápasů se nyní nepodařilo načíst.');
    });
    if (mode === "overlay" || mode === "thumbnail")pollTimer=setTimeout(refreshRenderMode,state.layer==='opening'?60000:15000);
  } catch (error) {
    console.error(error);
    if(mode==='control'){
      state.controlError=error.message||'Data se nepodařilo načíst.';renderControl();if(channel)await channel.init();
      if(source==='hms'&&organizationFromCatalog(organizationCatalog,org)?.configured&&state.browseIds===null)loadDay().then(()=>renderControl()).catch(()=>{});
    }else renderStatus(error.message || "Data se nepodařilo načíst.", true);
    if(mode==='overlay')pollTimer=setTimeout(refreshRenderMode,15000);
  }
}

if(mode==='channel')runChannelView({id:params.get('channel'),api:API_BASE,root:app,base:location.href});else start();
