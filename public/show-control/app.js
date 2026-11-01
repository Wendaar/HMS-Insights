import {cues,adCues,cueChannel,reconcile,profileKeys,ledgerKey,signature,finishAnnouncement,sponsorAds} from './model.js';
import {ShowAudio} from './audio.js';
import {defaultPronunciations,pronunciationRules,announcementText,matchingVoices,spokenText} from './speech.js';
import {fetchSponsorCatalog} from '../sponsors/model.js';
import {resolveMedia} from '../media-mapping/model.js';
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
let centralMedia=null,mappingVersion=0,speechRequest=null,preparing=null,serverVersion=0;
const preparedSpeech=new Map();
const language=()=>$('language').value;
const spokenEvent=e=>announcementText(e,language());
const speechKey=text=>JSON.stringify([org(),language(),text,audio.rate,audio.pauseMs,audio.pronunciations]);
function cancelPreparation(){speechRequest?.abort();speechRequest=null;preparing=null;}
async function serverStatus(){const version=++serverVersion;const current=org();try{const data=await get('/api/show-speech?'+new URLSearchParams({org:current}));if(version!==serverVersion||current!==org())return;$('serverInfo').textContent=data.configured?'Serverový hlas je připojený. Použijte kód organizace.':'Serverový hlas zatím není připojený. Dostupný je hlas zařízení.';}catch{if(version===serverVersion)$('serverInfo').textContent='Stav serverového hlasu nelze ověřit.';}}
async function prepareSpeech(text){
  if(!$('speechCode').value.trim())throw Error('Zadejte kód Operations / správy pro serverový hlas.');
  const request=new AbortController();speechRequest=request;const timeout=setTimeout(()=>request.abort(),25000);
  try{const r=await fetch('/api/show-speech?'+new URLSearchParams({org:org()}),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+$('speechCode').value.trim()},body:JSON.stringify({text:spokenText(text,audio.pronunciations,language()),language:language(),rate:audio.rate,pauseMs:audio.pauseMs}),signal:request.signal});if(!r.ok){const d=await r.json();throw Error(d.error||'Serverový hlas není dostupný.');}if(!r.headers.get('content-type')?.startsWith('audio/'))throw Error('Server nevrátil hlasové audio.');return await r.blob();}finally{clearTimeout(timeout);if(speechRequest===request)speechRequest=null;}
}
const assets=new Map(),synth=globalThis.speechSynthesis;
const audio=new ShowAudio({onChange:message=>{if(message)notice(message);$('now').textContent=Object.entries(audio.tracks).map(([channel,t])=>`${channel==='bed'?'Hudba':'Efekt'}: ${t.label}`).join(' · ')||'Žádný zvuk nehraje';}});
const org=()=>$('org').value,mode=()=>$('mode').value,gameId=()=>selected?.id??'no-game';
const team=side=>mode()==='test'?`test-${side}`:selected?.[side]?.id;
async function loadCentralMedia(){const version=++mappingVersion,current=org();$('mappingLink').href='/media-mapping?'+new URLSearchParams({org:current});try{const data=await get('/api/media-mapping?'+new URLSearchParams({org:current}));if(version!==mappingVersion||org()!==current)return;if(data.org!==current||data.config?.org!==current||!Array.isArray(data.assets))throw new Error();centralMedia=data;$('mediaStatus').textContent=data.storageReady?`${data.sandbox?'PREVIEW · ':''}Centrální knihovna · ${data.config.bindings.length} zveřejněných přiřazení`:'Centrální ukládání není připojené. Dostupné jsou jen místní testovací zvuky.';}catch{if(version!==mappingVersion||org()!==current)return;$('mediaStatus').textContent=centralMedia?'Knihovnu se nepodařilo obnovit. Používá se poslední načtené přiřazení.':'Centrální knihovna není dostupná. Místní testy zůstávají dostupné.';}}
const validGame=id=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
const pollMs=()=>Number($('pollInterval').value)*1000;
const staleMs=()=>Math.max(45000,pollMs()+20000);
function rememberSelection(){try{localStorage.setItem('show:last-org:v1',org());localStorage.setItem(`show:selection:v1:${org()}`,JSON.stringify({mode:mode(),gameId:mode()==='live'&&validGame(selected?.id)?selected.id:null,label:selected?.home&&selected?.away?`${selected.home.name} × ${selected.away.name}`:'Obnovený zápas',filter:$('filter').value}));}catch{notice('Vybraný zápas nelze v tomto prohlížeči zapamatovat.');}}
function restoreSelection(){try{const saved=JSON.parse(localStorage.getItem(`show:selection:v1:${org()}`)??'null');if(!saved)return;if(['live','test'].includes(saved.mode))$('mode').value=saved.mode;if([...$('filter').options].some(o=>o.value===saved.filter))$('filter').value=saved.filter;if(saved.mode==='live'&&validGame(saved.gameId)){$('game').append(option(saved.gameId,typeof saved.label==='string'?saved.label.slice(0,240):'Obnovený zápas'));$('game').value=saved.gameId;}}catch{}}
function updateSpeechOptions(){$('serverAccess').hidden=$('speechEngine').value!=='server';$('serverInfo').hidden=$('speechEngine').value!=='server';}
function saveVoice(){updateSpeechOptions();audio.language=language();audio.rate=Number($('rate').value);audio.pauseMs=Number($('speechPause').value);audio.pronunciations=pronunciationRules($('pronunciations').value);try{localStorage.setItem(`show:voice:v1:${org()}`,JSON.stringify({rate:audio.rate,pauseMs:audio.pauseMs,pronunciations:$('pronunciations').value.slice(0,12000),pollInterval:$('pollInterval').value,language:language(),engine:$('speechEngine').value,voiceURI:$('voice').value}));}catch{notice('Volby hlasatele nelze uložit.');}}
function loadVoice(){let saved={};try{saved=JSON.parse(localStorage.getItem(`show:voice:v1:${org()}`)??'{}')??{};}catch{}$('language').value=saved.language==='en'?'en':'cs';$('speechEngine').value=saved.engine==='server'?'server':'device';updateSpeechOptions();audio.language=language();voices(saved.voiceURI);$('rate').value=Number.isFinite(saved.rate)&&saved.rate>=.75&&saved.rate<=1.1?saved.rate:.9;$('speechPause').value=Number.isFinite(saved.pauseMs)&&saved.pauseMs>=100&&saved.pauseMs<=600?saved.pauseMs:250;$('pronunciations').value=typeof saved.pronunciations==='string'?saved.pronunciations.slice(0,12000):defaultPronunciations.map(r=>r.join(' = ')).join('\n');$('pollInterval').value=['10','30'].includes(saved.pollInterval)?saved.pollInterval:'30';audio.rate=Number($('rate').value);audio.pauseMs=Number($('speechPause').value);audio.pronunciations=pronunciationRules($('pronunciations').value);}
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
function reset(){cancelPreparation();generation++;clearTimeout(timer);controller?.abort();audio.stop();activeAnnouncement=null;centralMedia=null;mappingVersion++;assets.clear();liveReady=false;lastRead=0;events=[];render();}
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
    const text=document.createElement('p');text.textContent=spokenEvent(e)??'Anglický text této události není dostupný. Obnovte LIVE data nebo zvolte češtinu.';
    const controls=document.createElement('div');controls.className='row';
    const play=document.createElement('button');play.className='play';play.textContent=e.status==='Done'?'↻ Znovu TTS':'▶ Play TTS';
    if($('speechEngine').value==='server')play.textContent=preparing?.id===e.id?'Připravuji hlas…':preparedSpeech.has(speechKey(spokenEvent(e)))?'▶ Přehrát hlas':'↓ Připravit hlas';
    play.disabled=!spokenEvent(e)||!!preparing||e.status==='Playing'||mode()==='live'&&(!liveReady||Date.now()-lastRead>staleMs());play.onclick=()=>speakEvent(e);
    const skip=document.createElement('button');skip.textContent='Přeskočit';skip.disabled=e.status==='Skipped';skip.onclick=()=>{if(preparing?.id===e.id)cancelPreparation();if(e.status==='Playing')audio.cancel();e.status='Skipped';persist();render();};controls.append(play,skip);
    if(e.status==='Playing'){const retry=document.createElement('button');retry.textContent='↻ Restart';retry.onclick=()=>speakEvent(e);controls.append(retry);}card.append(meta,text,controls);$('events').append(card);
  }
}
function voice(){return matchingVoices(synth?.getVoices(),language()).find(v=>v.voiceURI===$('voice').value);}
async function speakEvent(e){
  if(mode()==='live'&&(!liveReady||Date.now()-lastRead>staleMs()))return notice('LIVE data nejsou aktuální. Nejdříve je obnovte.');
  const text=spokenEvent(e);if(!text)return notice('Pro tuto událost není dostupný anglický text. Obnovte data.');
  const run=generation,id=e.id,revision=signature(e),key=speechKey(text);
  if($('speechEngine').value==='server'&&!preparedSpeech.has(key)){
    if(preparing)return;audio.cancel();const job={id};preparing=job;render();notice('Připravuji audio hlášení…');
    try{const blob=await prepareSpeech(text);if(preparing!==job||run!==generation||!events.some(n=>n.id===id&&!n.withdrawn&&signature(n)===revision))return;while(preparedSpeech.size>=16)preparedSpeech.delete(preparedSpeech.keys().next().value);preparedSpeech.set(key,blob);notice('Audio připravené. Klepněte na Přehrát hlas.');}catch(error){if(preparing===job)notice(error.message);}finally{if(preparing===job){preparing=null;render();}}return;
  }
  audio.cancel();activeAnnouncement={id,revision};finishAnnouncement(events,id,revision,'Playing');persist();render();
  const done=status=>{if(run!==generation)return;finishAnnouncement(events,id,revision,status);activeAnnouncement=null;persist();render();};
  try{if($('speechEngine').value==='server')await audio.speakFile(preparedSpeech.get(key),done);else audio.speak(text,voice(),done);}catch(error){done('New');notice(error.name==='NotAllowedError'?'Audio připravené. Klepněte znovu pro přehrání.':error.message);}
}
function voices(preferred){const previous=typeof preferred==='string'?preferred:$('voice').value;const list=matchingVoices(synth?.getVoices(),language());$('voice').replaceChildren(option('','Systémový hlas · podle jazyka'),...list.map(v=>option(v.voiceURI,v.name+(v.localService?' · zařízení':' · online'))));if(list.some(v=>v.voiceURI===previous))$('voice').value=previous;else if(list.length)$('voice').value=list[0].voiceURI;$('voiceInfo').textContent=!synth?'Prohlížeč nepodporuje řeč. Použijte serverový hlas.':list.length?'Hlasy dostupné pro zvolený jazyk. Před utkáním vyzkoušejte hlas.':'Prohlížeč nevrátil hlas zvoleného jazyka. Lze zkusit systémový hlas; správný jazyk ověřte poslechem, nebo použijte serverový hlas.';}
voices();synth?.addEventListener('voiceschanged',()=>voices());
for(const delay of [500,1500,3000])setTimeout(()=>voices(),delay);
$('refreshVoices').onclick=()=>{voices();serverStatus();};
$('voice').onchange=saveVoice;
$('language').onchange=()=>{cancelPreparation();audio.cancel();voices();saveVoice();render();notice(language()==='en'?'English announcements selected.':'Zvolena česká hlášení.');};
$('speechEngine').onchange=()=>{cancelPreparation();audio.cancel();saveVoice();render();};
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
    await loadCentralMedia();if(run===generation)await loadPads();
  }catch(error){if(run!==generation)return;liveReady=false;audio.cancel();connection(`LIVE nedostupné · ${error.message}`);}finally{clearTimeout(timeout);if(pollInFlight===run)pollInFlight=null;if(run===generation){render();clearTimeout(timer);timer=setTimeout(()=>poll(run),pollMs());}}
}
async function choose(){
  reset();const run=generation;if(mode()==='test'){selected={id:'manual',home:{id:'test-home',name:'Test domácí'},away:{id:'test-away',name:'Test hosté'}};$('match').textContent='RUČNÍ TEST · žádná živá data';connection('TEST · ruční eventy, bez připojení k HMS','test');}
  else{selected=$('game').value?{id:$('game').value}:null;$('match').textContent='Vyberte zápas';connection(selected?'Načítám ověřené LIVE události…':'LIVE zatím není připojeno.');}
  selectionDetails.open=mode()==='live'&&!selected;
  rememberSelection();loadVoice();serverStatus();$('speechCode').value='';$('testTools').hidden=mode()!=='test';restore();render();renderAds();loadSponsors();await loadCentralMedia();if(run!==generation)return;await loadPads();if(selected&&mode()==='live')poll(run);
}
const cueTeam=cue=>cue[3].startsWith('ad:')?null:cue[2]==='HOME'?team('home'):cue[2]==='AWAY'?team('away'):null;
async function resolveAsset(cue,currentOrg){const mapped=resolveMedia(centralMedia?.config,centralMedia?.assets??[],{org:currentOrg,gameId:selected?.id,homeId:team('home'),awayId:team('away'),cue:cue[3],side:cue[2]==='AWAY'?'away':'home'});if(mapped){if(!mapped.asset)return {missing:true,key:'central',name:'Přiřazený soubor chybí'};return {key:'central',sourceLabel:({game:'Zápas',team:'Tým',default:'Organizace',sponsor:'Sponzor'})[mapped.source],url:mapped.asset.path+'?v='+mapped.asset.checksum,name:mapped.asset.title,binding:mapped.binding};}for(const k of profileKeys(currentOrg,cueTeam(cue),cue[3])){const value=await loadStudioAsset(k);if(value?.blob instanceof Blob)return {...value,key:k};}return null;}
async function loadPads(){
  const version=++padVersion,current=org(),activeCues=[...cues,...adCues(activeAds())];setupKinds();
  const buttons=[];
  for(const cue of activeCues){const b=document.createElement('button');b.className='pad';b.dataset.cue=cue[0];const title=document.createElement('strong');title.textContent=cue[3].startsWith('ad:')?cue[2]:cue[1];const side=document.createElement('span');side.textContent=cue[3].startsWith('ad:')?cue[1]:cue[2];const hint=document.createElement('small');b.append(title,side,hint);b.disabled=true;b.onclick=()=>playCue(cue);buttons.push(b);}
  try{const values=await Promise.all(activeCues.map(c=>resolveAsset(c,current)));if(version!==padVersion||current!==org())return;assets.clear();values.forEach((asset,i)=>{assets.set(activeCues[i][0],asset);const b=buttons[i];b.disabled=!asset||asset.missing;b.lastChild.textContent=asset?`${asset.sourceLabel??(asset.key.includes(':team:')?'Tým':asset.key.includes(':organization:')?'Organizace':'Výchozí')} · ${asset.name}`:'Nenastaveno · přiřaďte v Media Mapping';});$('pads').replaceChildren(...buttons.filter((_,i)=>!activeCues[i][3].startsWith('ad:')));$('adPads').replaceChildren(...buttons.filter((_,i)=>activeCues[i][3].startsWith('ad:')));$('adCount').textContent=String(activeCues.length-cues.length);}catch{if(version===padVersion)notice('Úložiště zvuků není dostupné v tomto prohlížeči.');}
  updateAssetLabel();
}
async function playCue(cue){const asset=assets.get(cue[0]);if(!asset||asset.missing)return;try{await audio.play(asset.blob??asset.url,cueChannel(cue[3]),{loop:asset.binding?.loop??['pregame','ingame'].includes(cue[3]),gain:asset.binding?.volume??1,label:cue[1]+' '+cue[2]});}catch{notice('Zvuk se nepodařilo spustit. Ověřte formát souboru a jeho dostupnost.');}}
function editKey(){const p=$('profile').value,kind=$('kind').value;if(kind.startsWith('ad:'))return profileKeys(org(),null,kind)[0];if(p.startsWith('team-')){const id=team(p.slice(5));if(!id)throw new Error('Nejdříve načtěte zápas nebo zvolte ruční test.');return profileKeys(org(),id,kind)[0];}return `show:v1:${org()}:${p}:${kind}`;}
async function updateAssetLabel(){let k;try{k=editKey();const data=await loadStudioAsset(k);if(k===editKey())$('asset').textContent=data?`V profilu: ${data.name}`:'Profil je prázdný. Použije se organizace nebo výchozí zvuk.';}catch(error){$('asset').textContent=error.message;}}
$('upload').onchange=async()=>{const file=$('upload').files[0];if(!file)return;if(file.size>30*1024*1024||!(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)||file.type.startsWith('audio/')))return notice('Vyberte audio soubor do 30 MB.');try{await saveStudioAsset(editKey(),{blob:file,name:file.name});notice('Zvuk uložen do profilu v tomto prohlížeči.');await loadPads();}catch(error){notice('Zvuk nelze uložit. '+error.message);}finally{$('upload').value='';}};
$('clear').onclick=async()=>{try{await removeStudioAsset(editKey());await loadPads();}catch(error){notice(error.message);}};
$('profile').onchange=updateAssetLabel;$('kind').onchange=updateAssetLabel;
$('stop').onclick=()=>{cancelPreparation();audio.stop();render();notice('Všechny zvuky a hlasatel zastaveny.');};
$('pause').onclick=()=>{audio.pause();notice('Zvuk i hlasatel pozastaveny.');};$('resume').onclick=()=>audio.resume().then(()=>notice('Přehrávání obnoveno.')).catch(()=>notice('Zvuk nelze obnovit. Zkuste povel znovu.'));
$('volume').oninput=()=>{audio.volume=Number($('volume').value)/100;audio.levels();};$('duck').oninput=()=>{audio.duck=Number($('duck').value)/100;audio.levels();};
$('voiceVolume').oninput=()=>{audio.voiceVolume=Number($('voiceVolume').value)/100;};
$('voiceTest').onclick=async()=>{const text=language()==='en'?'Welcome to today’s game. Your announcer is ready.':'Vítejte na dnešním utkání. Hlasatel je připraven.';try{if($('speechEngine').value==='device')audio.speak(text,voice(),()=>{});else{const key=speechKey(text);if(preparedSpeech.has(key))await audio.speakFile(preparedSpeech.get(key),()=>{});else{if(preparing)return;const job={id:'voice-test'},run=generation;preparing=job;render();try{const blob=await prepareSpeech(text);if(preparing!==job||run!==generation)return;while(preparedSpeech.size>=16)preparedSpeech.delete(preparedSpeech.keys().next().value);preparedSpeech.set(key,blob);notice('Ukázka připravená. Klepněte znovu na Vyzkoušet hlas.');}finally{if(preparing===job){preparing=null;render();}}}}}catch(error){notice(error.message);}};
$('mode').onchange=choose;$('game').onchange=choose;$('refresh').onclick=()=>{if(mode()==='test')notice('Ruční test nepoužívá LIVE API.');else choose();};
$('org').onchange=()=>{browseVersion++;reset();selected=null;$('game').replaceChildren(option('','Vyberte zápas'));offset=0;choose();browse();};
$('filter').onchange=()=>{offset=0;browse();};$('browse').onclick=()=>browse();$('previous').onclick=()=>{offset=Math.max(0,offset-20);browse();};$('next').onclick=()=>{offset+=20;browse();};$('count').onchange=render;
function testEvent(edit=false,duplicate=false){if(mode()!=='test')return;const value=$('testText').value.trim();if(!value)return;const old=events.filter(e=>!e.withdrawn).at(-1);if((edit||duplicate)&&!old)return notice('Nejdříve přidejte testovací událost.');const incoming=events.map(e=>({...e}));if(edit){const i=incoming.findIndex(e=>e.id===old.id);incoming[i]={...old,text:value};if(old.status==='Playing')audio.cancel();}else if(!duplicate)incoming.push({id:'test:'+crypto.randomUUID(),type:$('testType').value,side:'home',period:null,clock:null,text:value,manual:true});events=reconcile(events,incoming,[]);persist();render();notice(duplicate?'Stejné ID přijato znovu · žádný nový event.':edit?'Oprava přijata pod stejným ID.':'Testovací event přidán.');}
$('addTest').onclick=()=>testEvent();$('editTest').onclick=()=>testEvent(true);$('duplicateTest').onclick=()=>testEvent(false,true);
window.addEventListener('pagehide',()=>{cancelPreparation();clearTimeout(timer);controller?.abort();audio.stop();});
async function init(){try{const data=await get('/api/studio?catalog=1');orgs=data.organizations;if(!orgs?.length)throw new Error('Žádná připojená organizace.');$('org').replaceChildren(...orgs.map(o=>option(o.code,o.name)));let storedOrg;try{storedOrg=localStorage.getItem('show:last-org:v1');}catch{}const requested=new URLSearchParams(location.search).get('org')??storedOrg;if(orgs.some(o=>o.code===requested))$('org').value=requested;$('org').disabled=false;restoreSelection();const requestedGame=new URLSearchParams(location.search).get('gameId');if(validGame(requestedGame)){$('mode').value='live';if(![...$('game').options].some(o=>o.value===requestedGame))$('game').append(option(requestedGame,'Vybraný zápas z rozcestníku'));$('game').value=requestedGame;}await choose();browse();}catch(error){$('org').replaceChildren(option('LOCAL-TEST','Lokální test · bez organizace'));$('mode').value='test';await choose();notice('Katalog organizací není dostupný. '+error.message);}}
init();
