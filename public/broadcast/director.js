import {hmsBrand} from '../hms-brand.js';
import {loadOrganizationCatalog,organizationFromCatalog} from '../organization-catalog.js';
import {apiGame,parseGameInput,setBroadcastOrganizations,viewUrl} from './hms-source.js';
import {graphics,directorDefaults,availability,effectiveLayers,compactPageSize} from './director-model.js';
import {createDirectorChannel} from './director-channel.js';
import {createDirectorFrames} from './director-output.js';
import {teamPartners,mountPartnerPlaylist} from './partner-playlist.js';
import {eligibleAssets} from './extra-layers.js';
import {fetchSponsorCatalog,withSponsorOverrides} from '../sponsors/model.js';
import {mountLibrary} from './library.js';
import {broadcastPhotoChoices} from '../photo-picker/broadcast.js';
const root=document.querySelector('#director'),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang=params.get('lang')==='en'?'en':'cs',org=(params.get('org')??'PHM').toUpperCase(),game=null,catalog=[],sponsors=null,items=[],phase='pre',selected='opening',error='',busy=false,requestEpoch=0,refreshTimer,filter='Today',games=[],libraryReady=false,libraryRevision=-1,metadataRead=0,disposed=false;
let draft={...directorDefaults(),layer:'opening',side:'both'},sponsorDraft={...directorDefaults(),layer:'sponsors',corner:'bottom-right',sponsorRotation:{enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0}};
const tr=(cs,en)=>lang==='en'?en:cs;
let sourceProblems={};
const getDraft=()=>{let photoChoices={};try{photoChoices=broadcastPhotoChoices(JSON.parse(localStorage.getItem(`hms-broadcast-photos:${org}:${String(game?.ID??'').toLowerCase()}`)||'{}'));}catch{}return {org,gameId:game?.ID,lang,...draft,libraryItems:structuredClone(items),photoChoices};};
const channel=createDirectorChannel({getDraft,onChange:()=>paintOutput()});
root.innerHTML=`<header class="director-head">${hmsBrand()}<div class="game-title"><h1>Broadcast Studio V2</h1><strong id="game-title"></strong><p id="game-meta"></p></div><label><span id="org-label"></span><select id="org"></select></label><button id="change-game"></button><label class="language"><span id="lang-label"></span><select id="language"><option value="cs">CZ</option><option value="en">EN</option></select></label></header><div class="test-banner" id="test-banner"></div>
<main class="director-grid"><section class="director-left"><nav class="phase-tabs" role="tablist" aria-label="Match phase"></nav><div class="graphic-grid" id="graphics"></div><section class="panel"><h2 id="selected-title"></h2><div id="context-controls" class="context-controls"></div><p class="message" id="availability"></p><p class="note" id="preview-help"></p><button id="refresh-data"></button><p class="message" id="data-status" role="status"></p></section>
<details class="panel sponsor-panel" id="sponsor-settings"><summary id="sponsor-heading"></summary><div id="sponsor-controls" class="context-controls"></div><p class="note" id="sponsor-note"></p><div id="partner-slot" class="partner-panel"></div><details id="asset-library"><summary id="library-heading"></summary><div id="library-slot"></div></details><p><a id="catalog-link" target="_blank" rel="noopener"></a></p></details></section>
<aside class="director-right"><section class="panel"><div class="preview-heading"><span>PREVIEW</span><small id="preview-label"></small></div><div id="working-preview" class="director-preview"></div><p class="note" id="preview-composition"></p></section><section class="panel"><h2>PROGRAM / LIVE · OBS</h2><p id="program-status" role="status"></p><div id="program-layers"></div><div class="output-actions"><button id="show-main" class="show">SHOW MAIN</button><button id="hide-main">HIDE MAIN</button><button id="show-sponsors" class="show">SHOW SPONSORS</button><button id="hide-sponsors">HIDE SPONSORS</button><button id="hide-all" class="panic">HIDE ALL NOW</button></div><div class="output-links"><button id="create-channel"></button><button id="copy-obs">COPY OBS URL</button><button id="open-obs">OPEN OBS PREVIEW</button></div><p class="message" id="channel-error" role="status"></p><details class="technical"><summary id="technical-heading"></summary><label>OBS URL<input id="obs-url" readonly></label><button id="backup-control"></button><p id="technical-help"></p><a id="legacy-overlay" target="_blank" rel="noopener"></a><br><a id="legacy-control" target="_blank" rel="noopener"></a><br><a id="thumbnail" target="_blank" rel="noopener"></a></details></section></aside></main>
<dialog id="game-dialog"><div class="dialog-title"><h2 id="dialog-title"></h2><button id="close-games" aria-label="Close">✕</button></div><div class="filters"></div><p id="games-status" role="status"></p><div class="games-list"></div><details><summary id="manual-heading"></summary><form class="manual-form"><input id="game-input" aria-label="HMS Game ID or URL" required><button id="load-id"></button></form></details></dialog>`;
const $=id=>document.getElementById(id),frames=createDirectorFrames($('working-preview'));
$('change-game').after($('hide-all'));
const headerStatus=document.createElement('small');headerStatus.id='obs-head-status';$('game-meta').after(headerStatus);
new ResizeObserver(()=>{$('working-preview').style.setProperty('--preview-scale',String($('working-preview').clientWidth/1920));}).observe($('working-preview'));
function partnerOptions(settings){if(!game)return [];if(settings.layer==='cta')return eligibleAssets(items,{org,gameId:game.ID,homeId:game.homeId,awayId:game.awayId,side:settings.side,kind:'cta'});return settings.partnerSource==='hms'?sponsors?.org===org?teamPartners(sponsors,game,settings.side,items,settings.partnerScope,{requireSelection:!settings.assetId}):[]:eligibleAssets(items,{org,gameId:game.ID,homeId:game.homeId,awayId:game.awayId,side:settings.side,kind:'sponsor'});}
function status(id,settings=draft){const source=['leaders','leaders-strip','standings'].includes(id)?'league':['powerplay','next','results'].includes(id)?'context':['sponsors','announcement'].includes(id)&&settings.partnerSource==='hms'?'sponsors':null;if(source&&sourceProblems[source])return {state:'UNAVAILABLE',usable:false,cs:'Zdroj HMS neodpověděl. Obnovte data.',en:'HMS source failed. Refresh data.'};return availability(id,game,{error:!!error,settings,partnerCount:partnerOptions(settings).filter(p=>!settings.assetId||p.id===settings.assetId).length,libraryReady});}
function option(value,label,current){return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;}
function select(key,label,values,current,prefix='draft'){return `<label>${esc(label)}<select data-${prefix}="${key}">${values.map(([v,l])=>option(v,l,current)).join('')}</select></label>`;}
function teamOptions(both=true){return [['home',game?.['Home Team']??tr('Domácí','Home')],['away',game?.['Away Team']??tr('Hosté','Away')],...(both?[['both',tr('Oba týmy','Both teams')]]:[])];}
function settingsControls(settings,prefix){
 const id=settings.layer;let html='';
 if(prefix==='draft'&&['cta','powerplay','leaders-strip','standings'].includes(id))html+=select('corner',tr('Umístění','Position'),[['top-left',tr('Vlevo nahoře','Top left')],['top-right',tr('Vpravo nahoře','Top right')],['bottom-left',tr('Vlevo dole','Bottom left')],['bottom-right',tr('Vpravo dole','Bottom right')]],settings.corner,prefix);
 if(['lineup','scoresheet','leaders','leaders-strip','powerplay','next','results'].includes(id))html+=select('side',tr('Tým','Team'),teamOptions(['lineup','scoresheet'].includes(id)),settings.side,prefix);
 if(['lineup','scoresheet','standings'].includes(id)){
  const count=id==='lineup'?Math.max(0,...['home','away'].filter(s=>settings.side==='both'||s===settings.side).map(s=>game?.match?.roster?.filter(p=>p.side===s).length??0)):id==='scoresheet'?game?.match?.goals?.filter(g=>settings.side==='both'||g.side===settings.side).length??0:game?.league?.standings?.length??0;
  const size=compactPageSize(id,game,settings.side);
  if(count>size&&(id!=='standings'||settings.standingsView==='full'))html+=select('page',tr('Velký obsah · stránka','Large content · page'),Array.from({length:Math.ceil(count/size)},(_,i)=>[i+1,String(i+1)]),settings.page,prefix);
 }
 if(id==='periods')html+=select('period',tr('Zapsaný stav','Recorded score'),[['current',tr('Aktuální / konečný','Current / final')],['1',tr('Po 1. třetině','After period 1')],['2',tr('Po 2. třetině','After period 2')],['3',tr('Po 3. třetině','After period 3')]],settings.period,prefix);
 if(id==='insights')html+=select('insight',tr('Hráč / výkon','Player / performance'),[['',tr('Vyberte výkon','Select a performance')],...(game?.match?.insights??[]).map(p=>[p.id,`${p.name} · ${p.goals} G / ${p.assists} A · ${p.type==='hat-trick'?'Hattrick':tr('Vícebodový','Multi-point')}`])],settings.insight,prefix);
 if(['leaders','leaders-strip'].includes(id))html+=select('metric',tr('Statistika','Metric'),[['points',tr('Body','Points')],['goals',tr('Góly','Goals')],['assists',tr('Asistence','Assists')]],settings.metric,prefix);
 if(id==='standings')html+=select('standingsView',tr('Rozsah','Scope'),[['opponents',tr('Soupeři · skutečné pořadí','Opponents · official ranks')],['full',tr('Celá tabulka','Full standings')]],settings.standingsView,prefix);
 if(['sponsors','announcement','cta'].includes(id)){
  if(id!=='cta')html+=select('partnerSource',tr('Zdroj','Source'),[['hms',tr('Katalog HMS','HMS catalog')],['library',tr('Doplňky kanálu','Channel extras')]],settings.partnerSource,prefix);
  if(settings.partnerSource==='hms'&&id!=='cta')html+=select('partnerScope',tr('Platnost','Scope'),[['organization',tr('Katalog organizace · výslovný výběr','Organization catalog · explicit selection')],['team',tr('Vazby vybraného týmu','Selected team bindings')]],settings.partnerScope,prefix);
  if(settings.partnerScope==='team'||settings.partnerSource==='library'||id==='cta')html+=select('side',tr('Tým','Team'),teamOptions(id==='cta'),settings.side,prefix);
  const available=settings.partnerSource==='hms'?teamPartners(sponsors,game??{},settings.side,[],settings.partnerScope):partnerOptions(settings);
  html+=select('assetId',tr('Partner / položka','Partner / item'),[['',tr('Rotovat uložený výběr','Rotate saved selection')],...available.map(p=>[p.id,p.title])],settings.assetId,prefix);
  if(id!=='cta')html+=select('rotation',tr('Režim','Mode'),[['1',tr('Automatická rotace','Automatic rotation')],['0',tr('Držet jednoho partnera','Hold one partner')]],settings.sponsorRotation?.enabled?'1':'0',prefix)+`<label>${tr('Logo (s)','Show (s)')}<input data-${prefix}="showSeconds" type="number" min="1" max="300" value="${settings.sponsorRotation?.showSeconds??15}"></label><label>${tr('Pauza (s)','Pause (s)')}<input data-${prefix}="pauseSeconds" type="number" min="0" max="3600" value="${settings.sponsorRotation?.pauseSeconds??0}"></label>`;
  else html+=select('rotateSeconds',tr('Střídání (s)','Rotate (s)'),[5,10,15,30,60,120,300].map(n=>[n,String(n)]),settings.rotateSeconds,prefix);
 }
 return html;
}
function paint(){
 document.documentElement.lang=lang;$('language').value=lang;
 $('org-label').textContent=tr('Organizace','Organization');$('lang-label').textContent=tr('Jazyk','Language');$('change-game').textContent=tr('Změnit zápas','Change game');
 $('game-title').textContent=game?game.Name:tr('Vyberte zápas','Select a game');$('game-meta').textContent=game?`${org} · ${game.Date} ${game.Time} · ${game.status??'—'}`:org;
 $('test-banner').textContent=tr('TESTOVACÍ V2 · samostatný kanál · původní OBS výstupy zůstávají v dosavadním studiu.','TEST V2 · separate channel · existing OBS outputs remain in the original studio.');
 root.querySelector('.phase-tabs').innerHTML=[['pre','PRE-GAME'],['game','IN-GAME'],['break','BREAK'],['post','POST-GAME']].map(([id,title])=>`<button role="tab" data-phase="${id}" aria-selected="${phase===id}">${title}</button>`).join('');
 $('graphics').innerHTML=graphics.filter(g=>g.phases.includes(phase)).map(g=>{const a=status(g.id,g.sponsor?sponsorDraft:{...draft,layer:g.id});return `<button class="graphic-card" data-graphic="${g.id}" data-status="${a.state}" aria-pressed="${selected===g.id}" title="${esc(a[lang])}"><span>${esc(g[lang])}</span><small>${a.state}</small></button>`;}).join('');
 const graphic=graphics.find(g=>g.id===selected);$('selected-title').textContent=graphic?.[lang]??selected;
 $('context-controls').innerHTML=graphic?.sponsor?'':graphic?.planned?`<p>${tr('Připravujeme v navazující etapě. Dostupné statistiky se neodhadují.','Planned for the next stage. Missing statistics are never estimated.')}</p>`:settingsControls(draft,'draft');
 const a=status(selected,graphic?.sponsor?sponsorDraft:draft);$('availability').textContent=`${a.state} · ${a[lang]}`;
 $('preview-help').textContent=tr('Příprava mění pouze PREVIEW. Do OBS obsah odešle až SHOW.','Preparation only changes PREVIEW. SHOW sends prepared content to OBS.');
 $('refresh-data').textContent=tr('Obnovit data z HMS','Refresh HMS data');$('refresh-data').disabled=busy;
 $('data-status').textContent=error||tr(busy?'Načítám HMS…':'Data HMS · automaticky po 15 s',busy?'Loading HMS…':'HMS data · refresh every 15 s');
 $('preview-label').textContent=graphic?.[lang]??'';
 $('preview-composition').textContent=tr('Pracovní náhled hlavní grafiky. Partneři mají vlastní nastavení a SHOW SPONSORS.','Prepared main graphic. Partners have their own settings and SHOW SPONSORS.');
 $('sponsor-heading').textContent='SPONSOR LAYER · '+tr('nastavení a výběr','settings and selection');
 $('sponsor-controls').innerHTML=settingsControls(sponsorDraft,'sponsor');
 $('sponsor-note').textContent=tr('Rotace pokračuje při přepínání MAIN. Celoobrazovková nebo kolidující MAIN ji dočasně překryje; stav partnerů zůstane zapnutý. Změny výběru odešlete přes SHOW SPONSORS.','Rotation continues when MAIN changes. Full-screen or colliding MAIN temporarily covers partners without switching them off. Apply edits with SHOW SPONSORS.');
 $('library-heading').textContent=tr('Doplňky kanálu · mimořádný partner / QR','Channel extras · special partner / QR');$('catalog-link').textContent=tr('Otevřít centrální katalog HMS','Open HMS sponsor catalog');$('catalog-link').href='/sponsors?org='+encodeURIComponent(org);
 $('technical-heading').textContent=tr('Technické odkazy a záloha','Technical links and backup');$('backup-control').textContent=tr('Zálohovat soukromé ovládání V2','Back up private V2 control');
 $('technical-help').textContent=tr('Doporučená je stálá OBS URL. Přímý overlay slouží pevným scénám; nereaguje na SHOW/HIDE kanálu. Soukromý ovládací odkaz nesdílejte.','Use the stable OBS URL. Direct overlays are for fixed scenes and do not follow channel SHOW/HIDE. Keep private control links secret.');
 $('legacy-control').textContent=tr('Původní ovládání V1','Original V1 control');$('legacy-control').href='index.html?'+new URLSearchParams({org,lang,...(game?{game:game.ID}:{})});
 for(const [id,mode,label] of [['legacy-overlay','overlay',tr('Přímý overlay aktuální přípravy','Direct overlay of prepared graphic')],['thumbnail','thumbnail',tr('YouTube miniatura · původní nástroj','YouTube thumbnail · original tool')]]){$(id).hidden=!game;$(id).textContent=label;if(game)$(id).href=viewUrl(location.href,{...getDraft(),mode});}
 $('dialog-title').textContent=tr('Vyberte zápas','Select a game');$('manual-heading').textContent=tr('Pokročilé · HMS odkaz / Game ID','Advanced · HMS URL / Game ID');$('load-id').textContent=tr('Načíst','Load');
 wireSettings('draft',draft);wireSettings('sponsor',sponsorDraft);paintOutput();paintPreview();
}
function paintPreview(){
 if(!game){frames.clear();return;}
 if(selected==='insights'&&!draft.insight){frames.clear();return;}
 if(graphics.find(g=>g.id===selected)?.planned){frames.clear();return;}
 const s=selected==='sponsors'?{...getDraft(),...sponsorDraft}:getDraft();
 frames.render({...s,directorVersion:2,visible:true,mainVisible:true,sponsors:{visible:false}});
}
function paintOutput(){
 const info=channel.info(),s=info.state,visible=s?.directorVersion===2?effectiveLayers(s):{main:!!s?.visible,sponsors:false};
 $('obs-head-status').textContent='OBS CHANNEL · '+(!info.bound?tr('NEPŘIPOJENO','NOT CONNECTED'):info.hidePending?tr('SKRÝVÁM','HIDE PENDING'):info.error?tr('NEOVĚŘENO','UNKNOWN'):visible.main||visible.sponsors?'LIVE':'HIDDEN');
 $('program-status').textContent=info.hidePending?tr('SKRYTO LOKÁLNĚ · čekám na potvrzení serveru','HIDDEN LOCALLY · awaiting server acknowledgement'):!info.bound?tr('Nepřipojený testovací kanál','No test channel'):info.error?tr('POSLEDNÍ ZNÁMÝ STAV · spojení není potvrzeno','LAST KNOWN STATE · connection unavailable'):info.pending?tr('Odesílám příkaz…','Sending command…'):tr('Potvrzený stav kanálu','Confirmed channel state')+` · r${info.revision??'—'}`;
 const name=graphics.find(g=>g.id===s?.layer)?.[lang]??s?.layer??'—';
 $('program-layers').innerHTML=`<div class="program-line"><span>MAIN · ${esc(name)}</span><strong>${info.hidePending?'HIDDEN':visible.main?'LIVE':'HIDDEN'}</strong></div><div class="program-line"><span>SPONSORS</span><strong>${info.hidePending?'HIDDEN':visible.covered?tr('PŘEKRYTO','COVERED'):visible.sponsors?'LIVE':'HIDDEN'}</strong></div>${s?`<p class="note">${esc(s.org)} · ${esc(s.gameId)} · ${esc(s.lang.toUpperCase())}</p>`:''}`;
 const a=status(selected),canMain=game&&!graphics.find(g=>g.id===selected)?.planned&&selected!=='sponsors'&&a.usable&&!(selected==='insights'&&!draft.insight);
 $('show-main').disabled=!info.ready||!!info.error||info.pending||info.hidePending||!canMain;
 $('show-sponsors').disabled=!info.ready||!!info.error||info.pending||info.hidePending||!game||!status('sponsors',sponsorDraft).usable;
 $('hide-main').disabled=$('hide-sponsors').disabled=!info.ready||info.pending||info.hidePending;
 $('hide-all').disabled=!info.bound; // Never disabled by HMS failures or a pending publish.
 $('create-channel').hidden=info.bound;$('create-channel').textContent=tr('Vytvořit testovací OBS kanál','Create test OBS channel');$('create-channel').disabled=!game||info.pending;
 $('obs-url').value=info.url;$('copy-obs').disabled=$('open-obs').disabled=$('backup-control').disabled=!info.bound;
 $('channel-error').textContent=info.error||'';
 if(info.ready&&libraryRevision!==info.revision&&!busy){libraryRevision=info.revision;loadLibrary();}
}
function wireSettings(prefix,settings){root.querySelectorAll(`[data-${prefix}]`).forEach(el=>el.onchange=()=>{
 if(!el.checkValidity())return;const key=el.dataset[prefix];
 if(['rotation','showSeconds','pauseSeconds'].includes(key)){settings.sponsorRotation??={enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0};if(key==='rotation')settings.sponsorRotation.enabled=el.value==='1';else settings.sponsorRotation[key]=Number(el.value);}
 else settings[key]=['page','rotateSeconds'].includes(key)?Number(el.value):el.value;
 if(['side','partnerSource','partnerScope'].includes(key)){settings.assetId='';settings.page=1;}
 if(prefix==='draft'&&key==='side')draft.insight='';paint();if(prefix==='sponsor'||['announcement','sponsors'].includes(draft.layer))mountPartners();
 });}
async function api(query,signal){const url=new URL('/api/broadcast',location.origin);url.search=new URLSearchParams({org,...query});const response=await fetch(url,{cache:'no-store',signal:signal??AbortSignal.timeout(16000)}),data=await response.json();if(!response.ok)throw new Error(data.error||tr('HMS není dostupné','HMS unavailable'));if(data.org!==org)throw new Error('Organization mismatch');return data;}
async function loadSelected(id,{newGame=false}={}){
 const epoch=++requestEpoch,selectedOrg=org;busy=true;error='';paint();
 try{const checked=parseGameInput(id,org);if(checked.org!==org){await changeOrg(checked.org,checked.gameId);return;}
  const data=await api({gameId:checked.gameId,live:'1'}),next=apiGame(data,org,checked.gameId);if(epoch!==requestEpoch||org!==selectedOrg)return;
  const same=game?.ID.toLowerCase()===next.ID.toLowerCase();if(same){next.league=game.league;next.context=game.context;}else{draft={...directorDefaults(),layer:'opening',side:'both'};sponsorDraft={...directorDefaults(),layer:'sponsors',corner:'bottom-right',sponsorRotation:{enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0}};selected='opening';metadataRead=0;}
  game=next;const url=new URL(location.href);url.search=new URLSearchParams({org,game:game.ID,lang});history.replaceState(null,'',url);if(newGame)$('game-dialog').close();
  if(Date.now()-metadataRead>60000){metadataRead=Date.now();loadOptional(game,epoch);}
 }catch(e){if(epoch===requestEpoch)error=e.message;}
 finally{if(epoch===requestEpoch){busy=false;paint();if(newGame)mountPartners();}}
}
async function loadOptional(target,epoch){
 const scope=org;
 const results=await Promise.allSettled([api({gameId:target.ID,league:'1'}),api({gameId:target.ID,context:'1'},AbortSignal.timeout(60000)),fetchSponsorCatalog(org).then(withSponsorOverrides)]);
 if(org!==scope||game?.ID!==target.ID||results.some(r=>r.status==='fulfilled'&&r.value.org&&r.value.org!==org))return;
 sourceProblems=Object.fromEntries(['league','context','sponsors'].map((key,i)=>[key,results[i].status==='rejected']));
 if(results[0].status==='fulfilled')game.league=apiGame(results[0].value,org,target.ID).league;
 if(results[1].status==='fulfilled')game.context=apiGame(results[1].value,org,target.ID).context;
 sponsors=results[2].status==='fulfilled'&&results[2].value.org===org?results[2].value:null;paint();if($('sponsor-settings').open)mountPartners();
}
async function loadLibrary(){try{const value=await channel.library();items=(value.items??[]).filter(item=>item.org===org);libraryReady=true;paint();}catch{libraryReady=false;}}
function mountPartners(){if(!game||!$('sponsor-settings').open)return;const settings=selected==='announcement'?draft:sponsorDraft;mountPartnerPlaylist($('partner-slot'),{catalog:sponsors,game,side:settings.side,partnerScope:settings.partnerScope,rotation:settings.sponsorRotation,channel,lang,onSaved:async()=>{await loadLibrary();mountPartners();}});}
async function browse(){const epoch=requestEpoch;const selectedOrg=org;$('games-status').textContent=tr('Načítám zápasy…','Loading games…');try{const data=await api({filter});if(org!==selectedOrg||epoch!==requestEpoch)return;games=data.items??[];$('games-status').textContent=data.hasMore?tr('Prvních 20 zápasů · další lze otevřít přes Game ID.','First 20 games · use Game ID for others.'):'';root.querySelector('.games-list').innerHTML=games.map(g=>`<button data-game="${esc(g.gameId)}">${esc(g.home?.name??'—')} — ${esc(g.away?.name??'—')}<small>${esc(g.playedOn??'')} ${esc(g.startTime??'')} · ${esc(g.status??'')}</small></button>`).join('')||`<p>${tr('V tomto období nejsou zápasy.','No games in this period.')}</p>`;}catch(e){$('games-status').textContent=e.message;}}
function openGames(){$('game-dialog').showModal();root.querySelector('.filters').innerHTML=[['Today',tr('Dnes','Today')],['Tomorrow',tr('Zítra','Tomorrow')],['+7 days',tr('Příštích 7 dnů','Next 7 days')],['Past',tr('Minulé','Past')]].map(([id,label])=>`<button data-filter="${id}">${label}</button>`).join('');browse();}
async function changeOrg(next,id){
 requestEpoch++;org=next;game=null;games=[];items=[];sponsors=null;libraryReady=false;libraryRevision=-1;sourceProblems={};busy=false;error='';metadataRead=0;frames.clear();
 draft={...directorDefaults(),layer:'opening',side:'both'};
 sponsorDraft={...directorDefaults(),layer:'sponsors',corner:'bottom-right',sponsorRotation:{enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0}};
 selected='opening';$('partner-slot').replaceChildren();$('library-slot').replaceChildren();$('org').value=org;
 history.replaceState(null,'',location.pathname+'?'+new URLSearchParams({org,lang}));paint();
 if(id)await loadSelected(id,{newGame:true});else if(!$('game-dialog').open)openGames();else browse();
}
root.addEventListener('click',e=>{
 const phaseButton=e.target.closest('[data-phase]');if(phaseButton){phase=phaseButton.dataset.phase;paint();return;}
 const graphic=e.target.closest('[data-graphic]');if(graphic){selected=graphic.dataset.graphic;if(selected==='sponsors'){$('sponsor-settings').open=true;mountPartners();}else if(!graphics.find(g=>g.id===selected)?.planned){draft.layer=selected;draft.page=1;draft.insight='';draft.assetId='';if(['lineup','scoresheet'].includes(selected))draft.side='both';else if(draft.side==='both')draft.side='home';if(selected==='announcement')draft.sponsorRotation={enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0};}paint();return;}
 const match=e.target.closest('[data-game]');if(match){loadSelected(match.dataset.game,{newGame:true});return;}
 const filterButton=e.target.closest('[data-filter]');if(filterButton){filter=filterButton.dataset.filter;browse();}
});
$('change-game').onclick=openGames;$('close-games').onclick=()=>$('game-dialog').close();
root.querySelector('.manual-form').onsubmit=e=>{e.preventDefault();loadSelected($('game-input').value,{newGame:true});};
$('org').onchange=e=>changeOrg(e.target.value);$('language').onchange=e=>{lang=e.target.value;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);paint();mountPartners();};
$('refresh-data').onclick=()=>{metadataRead=0;if(game)loadSelected(game.ID);else openGames();};
$('create-channel').onclick=async()=>{await channel.create();await loadLibrary();mountPartners();};
$('show-main').onclick=()=>channel.showMain();$('hide-main').onclick=()=>channel.hideMain();
$('show-sponsors').onclick=()=>{sponsorDraft.sponsorRotation.startedAt=Date.now();channel.showSponsors({...sponsorDraft,libraryItems:structuredClone(items)});};$('hide-sponsors').onclick=()=>channel.hideSponsors();$('hide-all').onclick=()=>channel.hideAll();
$('copy-obs').onclick=()=>copy(channel.info().url);$('backup-control').onclick=()=>copy(channel.controlLink());$('open-obs').onclick=()=>window.open(channel.info().url,'_blank','noopener');
async function copy(value){try{await navigator.clipboard.writeText(value);}catch{$('channel-error').textContent=tr('Kopírování není dostupné. Označte OBS URL v technické sekci.','Clipboard unavailable. Select the OBS URL in technical settings.');}}
$('sponsor-settings').ontoggle=()=>{if($('sponsor-settings').open)mountPartners();};
$('asset-library').ontoggle=()=>{if($('asset-library').open)mountLibrary($('library-slot'),{channel,org,game,lang,onSaved:async()=>{await loadLibrary();$('asset-library').open=false;}});};
async function tick(){if(disposed)return;if(game&&!busy)await loadSelected(game.ID);refreshTimer=setTimeout(tick,15000);}
addEventListener('pagehide',()=>{disposed=true;clearTimeout(refreshTimer);channel.stop();frames.clear();});
async function start(){paint();await channel.init();try{catalog=await loadOrganizationCatalog();setBroadcastOrganizations(catalog);$('org').innerHTML=catalog.map(o=>option(o.code,`${o.name}${o.configured?'':tr(' · nepřipojeno',' · not connected')}`,org)).join('');if(!organizationFromCatalog(catalog,org)?.configured)throw new Error(tr('Organizace nemá HMS připojení.','Organization has no HMS connection.'));if(params.get('game'))await loadSelected(params.get('game'));else openGames();}catch(e){error=e.message;paint();}refreshTimer=setTimeout(tick,15000);}
start();
