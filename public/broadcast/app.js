import {hmsBrand} from '/hms-brand.js';
import {apiGame,parseGameInput,viewUrl,organizations} from './hms-source.js';
import {language,translate,localize} from './i18n.js';
import {layers,layerNames,renderMatchLayer} from './match-layers.js';
import {createChannelControl,runChannelView,fitBroadcastCanvas} from './channel.js';
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
const source=params.get('source')??'hms';
const org=(params.get('org')??'PHM').toUpperCase();
const API_BASE=location.pathname.startsWith('/broadcast/')?'/api/broadcast':'https://hms-insights-five.vercel.app/api/broadcast';
const state = { games: [], teams: [], selectedId: params.get("game"), date: null, preview: "overlay", filter:params.get('filter')??'Today', readAt:null };
state.browseIds=null;state.controlError='';
Object.assign(state,{layer:layers.includes(params.get('layer'))?params.get('layer'):'opening',side:['home','away','both'].includes(params.get('side'))?params.get('side'):'home',period:['1','2','3'].includes(params.get('period'))?params.get('period'):'current',page:Math.min(50,Math.max(1,Number.parseInt(params.get('page'),10)||1)),insight:params.get('insight')??''});
let refreshing=false,lastSuccess=0,lastVisual='',pollTimer;
let previewObserver;
const channel=mode==='control'&&source==='hms'?createChannelControl({api:API_BASE,base:location.href,
  getState:()=>({org,gameId:state.selectedId,lang,layer:state.layer,side:state.side,period:state.period,page:state.page,insight:state.insight}),
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
}
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
  state.games=[game,...state.games.filter(g=>String(g.ID).toLowerCase()!==id.toLowerCase())];state.selectedId=game.ID;state.readAt=data.readAt;
  if(mode==='control'){const url=new URL(location.href);url.searchParams.set('game',game.ID);history.replaceState(null,'',url);}return game;
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
function renderUrl(view,game,clean=false){return viewUrl(location.href,{mode:view,org,gameId:game.ID,source,clean,lang,...state});}
function languageControl(){return `<label class="language-control">${t('Jazyk')}<select id="language"><option value="cs" ${lang==='cs'?'selected':''}>CZ</option><option value="en" ${lang==='en'?'selected':''}>EN</option></select></label>`;}
function layerControls(game){
  const option=(value,label,current)=>`<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(t(label))}</option>`;
  const m=game.match;
  const size=state.side==='both'?12:20;
  const count=state.layer==='lineup'?Math.max(...['home','away'].filter(s=>state.side==='both'||s===state.side).map(s=>m?.roster.filter(p=>p.side===s).length??0)):m?.goals.filter(g=>state.side==='both'||g.side===state.side).length??0;
  const pages=Math.max(1,Math.ceil(count/(state.layer==='lineup'?size:8)));
  return `<section class="layer-controls"><label>${t('Vrstva')}<select id="layer">${layers.map(l=>option(l,layerNames[l],state.layer)).join('')}</select></label>
    ${['lineup','scoresheet'].includes(state.layer)?`<label>${t('Tým')}<select id="layer-side">${[['home','Domácí'],['away','Hosté'],['both','Oba týmy']].map(([v,l])=>option(v,l,state.side)).join('')}</select></label><label>${t('Strana')}<select id="layer-page">${Array.from({length:pages},(_,i)=>option(String(i+1),String(i+1),String(state.page))).join('')}</select></label>`:''}
    ${state.layer==='periods'?`<label>${t('Třetina / stav')}<select id="layer-period">${[['current','Aktuální / konečný stav'],['1','Po 1. třetině'],['2','Po 2. třetině'],['3','Po 3. třetině']].map(([v,l])=>option(v,l,state.period)).join('')}</select></label>`:''}
    ${state.layer==='insights'?`<label>${t('Insight')}<select id="layer-insight">${m?.insights.length?m.insights.map(i=>option(i.id,`${i.name} · ${t(i.type==='hat-trick'?'Hattrick':'Vícebodový zápas')}`,state.insight)).join(''):option('','Žádný dostupný insight','')}</select></label>`:''}
    <p id="layer-help">${t(channel?.info().bound?'Přepínání níže automaticky mění obsah stálého OBS kanálu.':'Výběr vrstvy mění náhled a kopírovanou adresu. V OBS použijte adresu dané vrstvy.')}</p></section>`;
}
function connectionMarkup(){return `<section class="connection-bar"><form id="game-form"><label>Organizace<select id="org">${organizations.map(o=>`<option ${o===org?'selected':''}>${o}</option>`).join('')}</select></label><label class="game-input-label">Odkaz na zápas v HMS nebo Game ID<input id="game-input" value="${escapeHtml(state.selectedId??'')}" placeholder="https://prod.hms.wootera.net/org/euchl/games/…" required></label><button class="button primary">Načíst zápas</button></form><div class="browse-dates">${[['Today','Dnes'],['Tomorrow','Zítra'],['+7 days','Příštích 7 dnů'],['Past','Minulé zápasy']].map(([id,label])=>`<button class="button ${state.filter===id?'primary':''}" data-filter="${id}">${label}</button>`).join('')}<button class="button" id="refresh-data">Obnovit z HMS</button></div><p id="connection-status" role="status">${source==='sheet'?'Původní PHM Sheet · kompatibilní režim':`HMS API · ${org} · ${state.readAt?'načteno '+escapeHtml(new Date(state.readAt).toLocaleTimeString('cs-CZ')):'vyberte zápas'}${state.hasMore?' · zobrazeno prvních 20 zápasů, další otevřete odkazem':''}`}</p></section>`;}

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
  if(state.layer!=='opening'){app.innerHTML=renderMatchLayer(game,{...state,lang});return;}
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
  const obsUrl = game?publicOutputUrl(renderUrl('overlay',game)):'';
  app.innerHTML = `
    <div class="control-shell">
      <header class="control-header">
        ${hmsBrand()}<div class="brand-lockup">${org==='PHM'?`<img class="brand-mark" src="${BRAND_LOGOS[1]}" alt="PHM Cup" />`:`<strong class="brand-wordmark">${escapeHtml(org)}</strong>`}<div><p class="eyebrow">Broadcast graphics</p><h1>Opening Studio</h1></div></div>
        ${languageControl()}<div class="live-chip">${source==='hms'?'HMS API · '+escapeHtml(org):'Původní Google Sheet'}</div>
      </header>
      ${connectionMarkup()}
      <div class="control-grid">
        <aside class="match-panel">
          <div class="panel-title"><h2>Vyber zápas</h2><span class="count">${listed.length} zápasů</span></div>
          <div class="date-tabs">${dates.map((date) => `<button class="date-tab ${date === state.date ? "active" : ""}" data-date="${escapeHtml(date)}">${escapeHtml(date)}</button>`).join("")}</div>
          <div class="match-list">${dayGames.map((item) => { const model = gameModel(item); return `<button class="match-card ${String(item.ID) === String(game?.ID) ? "active" : ""}" data-game="${escapeHtml(item.ID)}"><div class="match-card-top"><span>${escapeHtml(item.Time || "--:--")}</span><span>${escapeHtml(item.Group || "PHM Cup")}${model.warnings.length ? '<i class="warn-dot" title="Chybějící nebo nejednoznačná data"></i>' : ""}</span></div><div class="match-card-teams">${escapeHtml(item["Home Team"] || "Bude doplněno")} — ${escapeHtml(item["Away Team"] || "Bude doplněno")}</div><div class="match-card-venue">${escapeHtml(item.Venue || "Místo bude doplněno")}</div></button>`; }).join("")}</div>
        </aside>
        <main class="workspace">
          <div id="channel-slot"></div>
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
  localize(app,lang);
  if(state.controlError)document.querySelector('#connection-status').textContent=t(state.controlError);
  document.querySelector('#language')?.addEventListener('change',event=>{lang=language(event.target.value);document.documentElement.lang=lang;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);renderControl();if(selectedGame())channel?.publish();});
  const settings={layer:'layer','layer-side':'side','layer-period':'period','layer-page':'page','layer-insight':'insight'};
  for(const [id,key] of Object.entries(settings))document.getElementById(id)?.addEventListener('change',event=>{
    state[key]=key==='page'?Number(event.target.value):event.target.value;
    if(key==='layer'||key==='side')state.page=1;
    const url=new URL(location.href);for(const k of ['layer','side','period','page','insight'])url.searchParams.set(k,state[k]);history.replaceState(null,'',url);renderControl();channel?.publish();
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
  document.querySelector("#open-view")?.addEventListener("click", () => { const game = selectedGame(); window.open(publicOutputUrl(renderUrl(state.preview,game,true)), "_blank", "noopener"); });
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
    const visual=JSON.stringify(game);lastSuccess=Date.now();document.body.dataset.connection='ok';
    if(visual!==lastVisual){if(mode==='overlay')renderOverlay(game);if(mode==='thumbnail')renderThumbnail(game);lastVisual=visual;}
  } catch (error) {
    document.body.dataset.connection='stale';console.warn('Automatická aktualizace dat se nezdařila.');
    if(mode==='overlay'&&(!lastSuccess||Date.now()-lastSuccess>(state.layer==='opening'?600000:60000)))app.replaceChildren();
  }finally{refreshing=false;clearTimeout(pollTimer);pollTimer=setTimeout(refreshRenderMode,document.body.dataset.connection==='ok'?(state.layer==='opening'?60000:15000):15000);}
}

async function start() {
  renderStatus("Načítám zápasy…");
  try {
    if(!organizations.includes(org)||!['hms','sheet'].includes(source)||source==='sheet'&&org!=='PHM')throw new Error('Neplatná organizace nebo zdroj dat.');
    if(source==='hms'){
      if(state.selectedId){parseGameInput(state.selectedId,org);await loadGame(state.selectedId);}
      else if(mode==='overlay'||mode==='thumbnail')throw new Error('V OBS URL chybí Game ID.');
      else{await loadDay();const first=state.games.find(g=>g._labelsAvailable);if(first)await loadGame(first.ID);}
    }else{
      [state.games,state.teams]=await Promise.all([loadSheet('Games'),loadSheet('Teams')]);
      if(!state.games.length)throw new Error('List Games je prázdný.');state.selectedId ||=state.games[0].ID;
    }
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
      if(source==='hms'&&state.browseIds===null)loadDay().then(()=>renderControl()).catch(()=>{});
    }else renderStatus(error.message || "Data se nepodařilo načíst.", true);
    if(mode==='overlay')pollTimer=setTimeout(refreshRenderMode,15000);
  }
}

if(mode==='channel')runChannelView({id:params.get('channel'),api:API_BASE,root:app,base:location.href});else start();
