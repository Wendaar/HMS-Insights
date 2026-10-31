import {cues,adCues,cueChannel,reconcile,profileKeys,ledgerKey,signature,finishAnnouncement,sponsorAds} from './model.js';
import {ShowAudio} from './audio.js';
import {defaultPronunciations,pronunciationRules} from './speech.js';
import {fetchSponsorCatalog} from '../sponsors/model.js';
import {loadStudioAsset,saveStudioAsset,removeStudioAsset} from '../studio/preferences.js';
const $=id=>document.getElementById(id),option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
const notice=message=>{$('notice').textContent=message??'';};
const selectionDetails=document.createElement('details');selectionDetails.id='matchSettings';selectionDetails.open=true;
const selectionSummary=document.createElement('summary');selectionSummary.textContent='Zápas a organizace';selectionDetails.append(selectionSummary);
const selection=document.querySelector('.selection');selection.before(selectionDetails);selectionDetails.append(selection);
document.querySelector('#settings h2').after(selectionDetails);
$('openSettings').onclick=()=>{selectionDetails.open=true;selectionDetails.scrollIntoView({behavior:'smooth',block:'start'});};
let orgs=[],selected=null,events=[],generation=0,browseVersion=0,offset=0,timer,controller,liveReady=false,lastRead=0,padVersion=0,pollInFlight=null;
let catalog=null,sponsorVersion=0,activeAnnouncement=null;
const assets=new Map(),synth=globalThis.speechSynthesis;
const audio=new ShowAudio({onChange:message=>{if(message)notice(message);$('now').textContent=Object.entries(audio.tracks).map(([channel,t])=>`${channel==='bed'?'Hudba':'Efekt'}: ${t.label}`).join(' · ')||'Žádný zvuk nehraje';}});
const org=()=>$('org').value,mode=()=>$('mode').value,gameId=()=>selected?.id??'no-game';
const team=side=>mode()==='test'?`test-${side}`:selected?.[side]?.id;
const validGame=id=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
const pollMs=()=>Number($('pollInterval').value)*1000;
const staleMs=()=>Math.max(45000,pollMs()+20000);
function rememberSelection(){try{localStorage.setItem('show:last-org:v1',org());localStorage.setItem(`show:selection:v1:${org()}`,JSON.stringify({mode:mode(),gameId:mode()==='live'&&validGame(selected?.id)?selected.id:null,label:selected?.home&&selected?.away?`${selected.home.name} × ${selected.away.name}`:'Obnovený zápas',filter:$('filter').value}));}catch{notice('Vybraný zápas nelze v tomto prohlížeči zapamatovat.');}}
function restoreSelection(){try{const saved=JSON.parse(localStorage.getItem(`show:selection:v1:${org()}`)??'null');if(!saved)return;if(['live','test'].includes(saved.mode))$('mode').value=saved.mode;if([...$('filter').options].some(o=>o.value===saved.filter))$('filter').value=saved.filter;if(saved.mode==='live'&&validGame(saved.gameId)){$('game').append(option(saved.gameId,typeof saved.label==='string'?saved.label.slice(0,240):'Obnovený zápas'));$('game').value=saved.gameId;}}catch{}}
function saveVoice(){audio.rate=Number($('rate').value);audio.pauseMs=Number($('speechPause').value);audio.pronunciations=pronunciationRules($('pronunciations').value);try{localStorage.setItem(`show:voice:v1:${org()}`,JSON.stringify({rate:audio.rate,pauseMs:audio.pauseMs,pronunciations:$('pronunciations').value.slice(0,12000),pollInterval:$('pollInterval').value}));}catch{notice('Volby hlasatele nelze uložit.');}}
function loadVoice(){let saved={};try{saved=JSON.parse(localStorage.getItem(`show:voice:v1:${org()}`)??'{}')??{};}catch{}$('rate').value=Number.isFinite(saved.rate)&&saved.rate>=.75&&saved.rate<=1.1?saved.rate:.9;$('speechPause').value=Number.isFinite(saved.pauseMs)&&saved.pauseMs>=100&&saved.pauseMs<=600?saved.pauseMs:250;$('pronunciations').value=typeof saved.pronunciations==='string'?saved.pronunciations.slice(0,12000):defaultPronunciations.map(r=>r.join(' = ')).join('\n');$('pollInterval').value=['10','30'].includes(saved.pollInterval)?saved.pollInterval:'30';audio.rate=Number($('rate').value);audio.pauseMs=Number($('speechPause').value);audio.pronunciations=pronunciationRules($('pronunciations').value);}
$('rate').oninput=saveVoice;$('speechPause').oninput=saveVoice;$('pronunciations').onchange=saveVoice;$('pollInterval').onchange=()=>{saveVoice();if(selected&&mode()==='live'){clearTimeout(timer);timer=setTimeout(()=>poll(),pollMs());}};
const activeAds=()=>[...sponsorAds(catalog,org(),[team('home'),team('away')],$('sponsorScope').value),...readAds()];
async function loadSponsors(){const version=++sponsorVersion,current=org();catalog=null;$('sponsorStatus').textContent='Načítám sponzory HMS…';loadPads();try{const data=await fetchSponsorCatalog(current);if(version!==sponsorVersion||org()!==current)return;catalog=data;$('sponsorStatus').textContent=`HMS · ${data.items.length} sponzorů organizace${data.relationshipStatus==='teams-unavailable'?' · týmové vazby nejsou dostupné':''}`;}catch{if(version!==sponsorVersion)return;$('sponsorStatus').textContent='Sponzoři HMS nejsou dostupní. Uložené vlastní spoty zůstávají dostupné.';}if(version===sponsorVersion)loadPads();}
$('sponsorRefresh').onclick=loadSponsors;$('sponsorScope').onchange=()=>loadPads();
const adStore=()=>`show:ads:v1:${org()}`;
function readAds(){try{const rows=JSON.parse(localStorage.getItem(adStore())??'[]');return Array.isArray(rows)?rows.filter(a=>typeof a.id==='string'&&/^[a-f0-9-]{36}$/.test(a.id)&&typeof a.name==='string'&&a.name.trim()).slice(0,40):[];}catch{return [];}}
function saveAds(rows){localStorage.setItem(adStore(),JSON.stringify(rows));}
function setupKinds(){const previous=$('kind').value,seen=new Set();$('kind').replaceChildren(...[...cues,...adCues(activeAds())].filter(c=>{if(seen.has(c[3]))return false;seen.add(c[3]);return true;}).map(c=>option(c[3],c[0].startsWith('ad:')?`${c[1]} · ${c[2]}`:c[1])));if([...$('kind').options].some(o=>o.value===previous))$('kind').value=previous;}
function renderAds(){
  $('adList').replaceChildren();for(const [i,ad] of readAds().entries()){
    const row=document.createElement('div');row.className='row';const label=document.createElement('label');label.textContent=`AD ${i+1} · název sponzora`;const input=document.createElement('input');input.value=ad.name;input.maxLength=80;label.append(input);
    const current=org();input.onchange=()=>{if(org()!==current)return;try{saveAds(readAds().map(a=>a.id===ad.id?{...a,name:input.value.trim()||a.name}:a));loadPads();}catch{notice('Název reklamy nelze uložit.');}};
    const remove=document.createElement('button');remove.textContent='Odebrat';remove.onclick=async()=>{if(org()!==current)return;try{const k=profileKeys(current,null,'ad:'+ad.id)[0];saveAds(readAds().filter(a=>a.id!==ad.id));await removeStudioAsset(k);if(org()===current){renderAds();loadPads();}}catch{notice('Reklamu nelze odebrat.');}};row.append(label,remove);$('adList').append(row);
  }
}
$('addAd').onclick=()=>{const name=$('adName').value.trim();if(!name)return notice('Zadejte název sponzora.');const rows=readAds();if(rows.length>=40)return notice('Limit je 40 reklam pro organizaci.');try{saveAds([...rows,{id:crypto.randomUUID(),name:name.slice(0,80)}]);$('adName').value='';renderAds();loadPads();notice('Reklamní tlačítko přidáno. V profilech vyberte jeho AD a nahrajte zvuk.');}catch{notice('Reklamu nelze uložit.');}};
function key(){return ledgerKey(org(),gameId(),mode());}
function persist(){try{localStorage.setItem(key(),JSON.stringify(events));}catch{notice('Historii nelze uložit. Neobnovujte stránku během obsluhy zápasu.');}}
function restore(){try{const rows=JSON.parse(localStorage.getItem(key())??'[]');events=Array.isArray(rows)?rows.filter(e=>typeof e.id==='string'&&typeof e.text==='string'&&['New','Playing','Done','Skipped'].includes(e.status)).map(e=>({...e,status:e.status==='Playing'?'New':e.status})):[];}catch{events=[];}}
function reset(){generation++;clearTimeout(timer);controller?.abort();audio.stop();activeAnnouncement=null;assets.clear();liveReady=false;lastRead=0;events=[];render();}
function connection(message,state='error'){$('connection').textContent=message;$('connection').dataset.state=state;}
function render(){
  $('events').replaceChildren();const visible=events.filter(e=>!e.withdrawn).slice(-Number($('count').value)).reverse();
  if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent=mode()==='test'?'Přidejte první testovací událost.':'Zatím žádné ověřené události.';$('events').append(p);}
  for(const e of visible){
    if(e.status==='Playing'&&(!activeAnnouncement||activeAnnouncement.id!==e.id||activeAnnouncement.revision!==signature(e)))e.status='New';
    const card=document.createElement('article');card.className='event';card.dataset.status=e.status;card.dataset.type=e.type;
    const meta=document.createElement('div');meta.className='event-meta';
    const type=document.createElement('span');type.className='event-type';type.textContent=`${({goal:'● GÓL',penalty:'● TREST',final:'VÝSLEDEK',stars:'★ HVĚZDY'})[e.type]??e.type.toUpperCase()} · ${e.period?`${e.period}. tř. `:''}${e.clock??'—'}${e.edited?' · OPRAVENO':''}`;
    const state=document.createElement('strong');state.textContent=e.status;meta.append(type,state);
    const text=document.createElement('p');text.textContent=e.text;
    const controls=document.createElement('div');controls.className='row';
    const play=document.createElement('button');play.className='play';play.textContent=e.status==='Done'?'↻ Znovu TTS':'▶ Play TTS';
    play.disabled=e.status==='Playing'||mode()==='live'&&(!liveReady||Date.now()-lastRead>staleMs());play.onclick=()=>speakEvent(e);
    const skip=document.createElement('button');skip.textContent='Přeskočit';skip.disabled=e.status==='Skipped';skip.onclick=()=>{if(e.status==='Playing')audio.cancel();e.status='Skipped';persist();render();};controls.append(play,skip);
    if(e.status==='Playing'){const retry=document.createElement('button');retry.textContent='↻ Restart';retry.onclick=()=>speakEvent(e);controls.append(retry);}card.append(meta,text,controls);$('events').append(card);
  }
}
function voice(){return synth?.getVoices().find(v=>v.voiceURI===$('voice').value);}
function speakEvent(e){
  if(mode()==='live'&&(!liveReady||Date.now()-lastRead>staleMs()))return notice('LIVE data nejsou aktuální. Nejdříve je obnovte.');
  const v=voice();if(!v)return notice('V zařízení není dostupný český hlas. Doplňte jej v nastavení systému a obnovte stránku.');
  audio.cancel();const revision=signature(e),run=generation,id=e.id;activeAnnouncement={id,revision};finishAnnouncement(events,id,revision,'Playing');persist();render();
  try{audio.speak(e.text,v,status=>{if(run!==generation)return;finishAnnouncement(events,id,revision,status);activeAnnouncement=null;persist();render();});}catch(error){finishAnnouncement(events,id,revision,'New');activeAnnouncement=null;persist();render();notice(error.message);}
}
function voices(){const previous=$('voice').value;const list=(synth?.getVoices()??[]).filter(v=>/^cs(?:-|$)/i.test(v.lang));$('voice').replaceChildren(...list.map(v=>option(v.voiceURI,`${v.name}${v.localService?' · zařízení':' · online'}`)));if(list.some(v=>v.voiceURI===previous))$('voice').value=previous;$('voiceInfo').textContent=list.length?'České hlasy dostupné v tomto zařízení.':'Český hlas není dostupný. Nainstalujte českou řeč v systému. Ostatní zvukové povely fungují samostatně.';}
voices();synth?.addEventListener('voiceschanged',voices);
async function get(url,signal){const r=await fetch(url,{signal:signal??AbortSignal.timeout(15000),cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Data nejsou dostupná.');return data;}
async function browse(){
  if(!orgs.some(o=>o.code===org()))return;const version=++browseVersion,current=org();$('browse').disabled=true;$('next').disabled=true;$('previous').disabled=true;
  try{const data=await get('/api/studio?'+new URLSearchParams({org:current,filter:$('filter').value,offset,section:'games'}));if(version!==browseVersion||current!==org())return;
    $('game').replaceChildren(option('','Vyberte zápas'),...data.items.map(g=>option(g.gameId,`${g.playedOn??g.date??''} · ${g.home?.name??'?'} × ${g.away?.name??'?'} · ${g.status??''}`)));
    if(mode()==='live'&&validGame(selected?.id)){if(![...$('game').options].some(o=>o.value===selected.id))$('game').append(option(selected.id,selected.home&&selected.away?`${selected.home.name} × ${selected.away.name}`:'Vybraný zápas · mimo zobrazené období'));$('game').value=selected.id;}
    $('schedule').textContent=data.source==='HMS'?'Seznam z HMS · Europe/Prague':data.source==='imported-snapshot'?'Pouze uložené importy. Dnešní a plánované zápasy mohou chybět.':'Zdroj seznamu není potvrzen.';
    $('next').disabled=!data.hasMore;$('previous').disabled=offset===0;
  }catch(error){if(version===browseVersion){$('schedule').textContent=error.message+' Ruční test je dostupný.';$('game').replaceChildren(option('','Seznam není dostupný'));if(mode()==='live'&&validGame(selected?.id)){$('game').append(option(selected.id,'Vybraný zápas · seznam není dostupný'));$('game').value=selected.id;}}}finally{if(version===browseVersion)$('browse').disabled=false;}
}
async function poll(run=generation){
  if(run!==generation||pollInFlight===run)return;clearTimeout(timer);if(mode()!=='live'||!selected)return;pollInFlight=run;
  const current=selected.id,currentOrg=org(),requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),15000);
  try{const data=await get('/api/broadcast?'+new URLSearchParams({org:currentOrg,gameId:current,live:'1'}),requestController.signal);if(run!==generation)return;
    if(data.org!==currentOrg||data.gameId?.toLowerCase()!==current.toLowerCase()||data.schemaVersion!==1)throw new Error('Odpověď neodpovídá vybrané organizaci a zápasu.');
    selected={id:current,home:data.home,away:data.away};$('match').textContent=`${data.home.name} × ${data.away.name}`;
    rememberSelection();
    const feed=data.showControl;if(!feed||!Array.isArray(feed.events)||!feed.types?.length)throw new Error('LIVE kolekce událostí nejsou dostupné. Lze použít ruční test.');
    if(events.some(e=>e.status==='Playing'&&feed.types.includes(e.type)&&!feed.events.some(n=>n.id===e.id&&signature(n)===signature(e))))audio.cancel();
    events=reconcile(events,feed.events,feed.types);persist();liveReady=true;lastRead=Date.now();
    connection(`LIVE HMS · načteno ${new Date().toLocaleTimeString('cs-CZ')} · ${feed.types.filter(t=>['goal','penalty'].includes(t)||feed.events.some(e=>e.type===t)).map(t=>({goal:'góly',penalty:'tresty',final:'výsledek',stars:'hvězdy'})[t]).join(', ')}${feed.omitted?` · ${feed.omitted} neověřených eventů vynecháno`:''}`,'live');
    render();
    await loadPads();
  }catch(error){if(run!==generation)return;liveReady=false;audio.cancel();connection(`LIVE nedostupné · ${error.message}`);}finally{clearTimeout(timeout);if(pollInFlight===run)pollInFlight=null;if(run===generation){render();clearTimeout(timer);timer=setTimeout(()=>poll(run),pollMs());}}
}
async function choose(){
  reset();const run=generation;if(mode()==='test'){selected={id:'manual',home:{id:'test-home',name:'Test domácí'},away:{id:'test-away',name:'Test hosté'}};$('match').textContent='RUČNÍ TEST · žádná živá data';connection('TEST · ruční eventy, bez připojení k HMS','test');}
  else{selected=$('game').value?{id:$('game').value}:null;$('match').textContent='Vyberte zápas';connection(selected?'Načítám ověřené LIVE události…':'LIVE zatím není připojeno.');}
  selectionDetails.open=mode()==='live'&&!selected;
  rememberSelection();loadVoice();$('testTools').hidden=mode()!=='test';restore();render();renderAds();loadSponsors();await loadPads();if(run===generation&&selected&&mode()==='live')poll(run);
}
const cueTeam=cue=>cue[3].startsWith('ad:')?null:cue[2]==='HOME'?team('home'):cue[2]==='AWAY'?team('away'):null;
async function resolveAsset(cue,currentOrg){for(const k of profileKeys(currentOrg,cueTeam(cue),cue[3])){const value=await loadStudioAsset(k);if(value?.blob instanceof Blob)return {...value,key:k};}return null;}
async function loadPads(){
  const version=++padVersion,current=org(),activeCues=[...cues,...adCues(activeAds())];setupKinds();$('pads').replaceChildren();$('adPads').replaceChildren();assets.clear();
  const buttons=[];
  for(const cue of activeCues){const b=document.createElement('button');b.className='pad';b.dataset.cue=cue[0];const title=document.createElement('strong');title.textContent=cue[3].startsWith('ad:')?cue[2]:cue[1];const side=document.createElement('span');side.textContent=cue[3].startsWith('ad:')?cue[1]:cue[2];const hint=document.createElement('small');hint.textContent='Načítám profil…';b.append(title,side,hint);b.disabled=true;b.onclick=()=>playCue(cue);(cue[3].startsWith('ad:')?$('adPads'):$('pads')).append(b);buttons.push(b);}
  $('adCount').textContent=String(activeCues.length-cues.length);
  try{const values=await Promise.all(activeCues.map(c=>resolveAsset(c,current)));if(version!==padVersion||current!==org())return;values.forEach((asset,i)=>{assets.set(activeCues[i][0],asset);const b=buttons[i];b.disabled=!asset;b.lastChild.textContent=asset?`${asset.key.includes(':team:')?'Tým':asset.key.includes(':organization:')?'Organizace':'Výchozí'} · ${asset.name}`:'Nenastaveno · nahrajte zvuk';});}catch{if(version===padVersion)notice('Úložiště zvuků není dostupné v tomto prohlížeči.');}
  updateAssetLabel();
}
async function playCue(cue){const asset=assets.get(cue[0]);if(!asset)return;try{await audio.play(asset.blob,cueChannel(cue[3]),{loop:['pregame','ingame'].includes(cue[3]),label:cue[1]+' '+cue[2]});}catch{notice('Zvuk se nepodařilo spustit. Ověřte formát souboru.');}}
function editKey(){const p=$('profile').value,kind=$('kind').value;if(kind.startsWith('ad:'))return profileKeys(org(),null,kind)[0];if(p.startsWith('team-')){const id=team(p.slice(5));if(!id)throw new Error('Nejdříve načtěte zápas nebo zvolte ruční test.');return profileKeys(org(),id,kind)[0];}return `show:v1:${org()}:${p}:${kind}`;}
async function updateAssetLabel(){let k;try{k=editKey();const data=await loadStudioAsset(k);if(k===editKey())$('asset').textContent=data?`V profilu: ${data.name}`:'Profil je prázdný. Použije se organizace nebo výchozí zvuk.';}catch(error){$('asset').textContent=error.message;}}
$('upload').onchange=async()=>{const file=$('upload').files[0];if(!file)return;if(file.size>30*1024*1024||!(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)||file.type.startsWith('audio/')))return notice('Vyberte audio soubor do 30 MB.');try{await saveStudioAsset(editKey(),{blob:file,name:file.name});notice('Zvuk uložen do profilu v tomto prohlížeči.');await loadPads();}catch(error){notice('Zvuk nelze uložit. '+error.message);}finally{$('upload').value='';}};
$('clear').onclick=async()=>{try{await removeStudioAsset(editKey());await loadPads();}catch(error){notice(error.message);}};
$('profile').onchange=updateAssetLabel;$('kind').onchange=updateAssetLabel;
$('stop').onclick=()=>{audio.stop();render();notice('Všechny zvuky a hlasatel zastaveny.');};
$('pause').onclick=()=>{audio.pause();notice('Zvuk i hlasatel pozastaveny.');};$('resume').onclick=()=>audio.resume().then(()=>notice('Přehrávání obnoveno.')).catch(()=>notice('Zvuk nelze obnovit. Zkuste povel znovu.'));
$('volume').oninput=()=>{audio.volume=Number($('volume').value)/100;audio.levels();};$('duck').oninput=()=>{audio.duck=Number($('duck').value)/100;audio.levels();};
$('voiceVolume').oninput=()=>{audio.voiceVolume=Number($('voiceVolume').value)/100;};
$('voiceTest').onclick=()=>{const v=voice();if(!v)return notice('Český hlas není dostupný.');try{audio.speak('Vítejte na dnešním utkání. Hlasatel je připraven.',v,()=>{});}catch(error){notice(error.message);}};
$('mode').onchange=choose;$('game').onchange=choose;$('refresh').onclick=()=>{if(mode()==='test')notice('Ruční test nepoužívá LIVE API.');else choose();};
$('org').onchange=()=>{browseVersion++;reset();selected=null;$('game').replaceChildren(option('','Vyberte zápas'));offset=0;choose();browse();};
$('filter').onchange=()=>{offset=0;browse();};$('browse').onclick=()=>browse();$('previous').onclick=()=>{offset=Math.max(0,offset-20);browse();};$('next').onclick=()=>{offset+=20;browse();};$('count').onchange=render;
function testEvent(edit=false,duplicate=false){if(mode()!=='test')return;const value=$('testText').value.trim();if(!value)return;const old=events.filter(e=>!e.withdrawn).at(-1);if((edit||duplicate)&&!old)return notice('Nejdříve přidejte testovací událost.');const incoming=events.map(e=>({...e}));if(edit){const i=incoming.findIndex(e=>e.id===old.id);incoming[i]={...old,text:value};if(old.status==='Playing')audio.cancel();}else if(!duplicate)incoming.push({id:'test:'+crypto.randomUUID(),type:$('testType').value,side:'home',period:null,clock:null,text:value});events=reconcile(events,incoming,[]);persist();render();notice(duplicate?'Stejné ID přijato znovu · žádný nový event.':edit?'Oprava přijata pod stejným ID.':'Testovací event přidán.');}
$('addTest').onclick=()=>testEvent();$('editTest').onclick=()=>testEvent(true);$('duplicateTest').onclick=()=>testEvent(false,true);
window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.abort();audio.stop();});
async function init(){try{const data=await get('/api/studio?catalog=1');orgs=data.organizations;if(!orgs?.length)throw new Error('Žádná připojená organizace.');$('org').replaceChildren(...orgs.map(o=>option(o.code,o.name)));let storedOrg;try{storedOrg=localStorage.getItem('show:last-org:v1');}catch{}const requested=new URLSearchParams(location.search).get('org')??storedOrg;if(orgs.some(o=>o.code===requested))$('org').value=requested;$('org').disabled=false;restoreSelection();await choose();browse();}catch(error){$('org').replaceChildren(option('LOCAL-TEST','Lokální test · bez organizace'));$('mode').value='test';await choose();notice('Katalog organizací není dostupný. '+error.message);}}
init();
