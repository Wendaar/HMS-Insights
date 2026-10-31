import {cues,reconcile,profileKeys,ledgerKey,signature} from './model.js';
import {ShowAudio} from './audio.js';
import {loadStudioAsset,saveStudioAsset,removeStudioAsset} from '../studio/preferences.js';
const $=id=>document.getElementById(id),option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
const notice=message=>{$('notice').textContent=message??'';};
const selectionDetails=document.createElement('details');selectionDetails.id='matchSettings';selectionDetails.open=true;
const selectionSummary=document.createElement('summary');selectionSummary.textContent='Zápas a organizace';selectionDetails.append(selectionSummary);
const selection=document.querySelector('.selection');selection.before(selectionDetails);selectionDetails.append(selection);
let orgs=[],selected=null,events=[],generation=0,browseVersion=0,offset=0,timer,controller,liveReady=false,lastRead=0,padVersion=0;
const assets=new Map(),synth=globalThis.speechSynthesis;
const audio=new ShowAudio({onChange:message=>{if(message)notice(message);$('now').textContent=Object.entries(audio.tracks).map(([channel,t])=>`${channel==='bed'?'Hudba':'Efekt'}: ${t.label}`).join(' · ')||'Žádný zvuk nehraje';}});
const org=()=>$('org').value,mode=()=>$('mode').value,gameId=()=>selected?.id??'no-game';
const team=side=>mode()==='test'?`test-${side}`:selected?.[side]?.id;
function key(){return ledgerKey(org(),gameId(),mode());}
function persist(){try{localStorage.setItem(key(),JSON.stringify(events));}catch{notice('Historii nelze uložit. Neobnovujte stránku během obsluhy zápasu.');}}
function restore(){try{const rows=JSON.parse(localStorage.getItem(key())??'[]');events=Array.isArray(rows)?rows.filter(e=>typeof e.id==='string'&&typeof e.text==='string'&&['New','Playing','Done','Skipped'].includes(e.status)).map(e=>({...e,status:e.status==='Playing'?'New':e.status})):[];}catch{events=[];}}
function reset(){generation++;clearTimeout(timer);controller?.abort();audio.stop();assets.clear();liveReady=false;lastRead=0;events=[];render();}
function connection(message,state='error'){$('connection').textContent=message;$('connection').dataset.state=state;}
function render(){
  $('events').replaceChildren();const visible=events.filter(e=>!e.withdrawn).slice(-Number($('count').value)).reverse();
  if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent=mode()==='test'?'Přidejte první testovací událost.':'Zatím žádné ověřené události.';$('events').append(p);}
  for(const e of visible){
    const card=document.createElement('article');card.className='event';card.dataset.status=e.status;
    const meta=document.createElement('div');meta.className='event-meta';
    const type=document.createElement('span');type.textContent=`${e.type.toUpperCase()} · ${e.period?`${e.period}. tř. `:''}${e.clock??'—'}${e.edited?' · OPRAVENO':''}`;
    const state=document.createElement('strong');state.textContent=e.status;meta.append(type,state);
    const text=document.createElement('p');text.textContent=e.text;
    const controls=document.createElement('div');controls.className='row';
    const play=document.createElement('button');play.className='play';play.textContent=e.status==='Done'?'↻ Znovu TTS':'▶ Play TTS';
    play.disabled=e.status==='Playing'||mode()==='live'&&(!liveReady||Date.now()-lastRead>45000);play.onclick=()=>speakEvent(e);
    const skip=document.createElement('button');skip.textContent='Přeskočit';skip.disabled=e.status==='Skipped';skip.onclick=()=>{if(e.status==='Playing')audio.cancel();e.status='Skipped';persist();render();};controls.append(play,skip);card.append(meta,text,controls);$('events').append(card);
  }
}
function voice(){return synth?.getVoices().find(v=>v.voiceURI===$('voice').value);}
function speakEvent(e){
  if(mode()==='live'&&(!liveReady||Date.now()-lastRead>45000))return notice('LIVE data nejsou aktuální. Nejdříve je obnovte.');
  const v=voice();if(!v)return notice('V zařízení není dostupný český hlas. Doplňte jej v nastavení systému a obnovte stránku.');
  audio.cancel();const revision=signature(e),run=generation;e.status='Playing';persist();render();
  try{audio.speak(e.text,v,status=>{if(run!==generation||!events.includes(e)||signature(e)!==revision)return;e.status=status;persist();render();});}catch(error){e.status='New';persist();render();notice(error.message);}
}
function voices(){const previous=$('voice').value;const list=(synth?.getVoices()??[]).filter(v=>/^cs(?:-|$)/i.test(v.lang));$('voice').replaceChildren(...list.map(v=>option(v.voiceURI,`${v.name}${v.localService?' · zařízení':' · online'}`)));if(list.some(v=>v.voiceURI===previous))$('voice').value=previous;$('voiceInfo').textContent=list.length?'České hlasy dostupné v tomto zařízení.':'Český hlas není dostupný. Nainstalujte českou řeč v systému. Ostatní zvukové povely fungují samostatně.';}
voices();synth?.addEventListener('voiceschanged',voices);
async function get(url,signal){const r=await fetch(url,{signal:signal??AbortSignal.timeout(15000),cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Data nejsou dostupná.');return data;}
async function browse(){
  if(!orgs.some(o=>o.code===org()))return;const version=++browseVersion,current=org();$('browse').disabled=true;$('next').disabled=true;$('previous').disabled=true;
  try{const data=await get('/api/studio?'+new URLSearchParams({org:current,filter:$('filter').value,offset,section:'games'}));if(version!==browseVersion||current!==org())return;
    $('game').replaceChildren(option('','Vyberte zápas'),...data.items.map(g=>option(g.gameId,`${g.playedOn??g.date??''} · ${g.home?.name??'?'} × ${g.away?.name??'?'} · ${g.status??''}`)));
    $('schedule').textContent=data.source==='HMS'?'Seznam z HMS · Europe/Prague':data.source==='imported-snapshot'?'Pouze uložené importy. Dnešní a plánované zápasy mohou chybět.':'Zdroj seznamu není potvrzen.';
    $('next').disabled=!data.hasMore;$('previous').disabled=offset===0;
  }catch(error){if(version===browseVersion){$('schedule').textContent=error.message+' Ruční test je dostupný.';$('game').replaceChildren(option('','Seznam není dostupný'));}}finally{if(version===browseVersion)$('browse').disabled=false;}
}
async function poll(run=generation){
  if(run!==generation)return;clearTimeout(timer);if(mode()!=='live'||!selected)return;
  const current=selected.id,currentOrg=org(),requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),15000);
  try{const data=await get('/api/broadcast?'+new URLSearchParams({org:currentOrg,gameId:current,live:'1'}),requestController.signal);if(run!==generation)return;
    if(data.org!==currentOrg||data.gameId?.toLowerCase()!==current.toLowerCase()||data.schemaVersion!==1)throw new Error('Odpověď neodpovídá vybrané organizaci a zápasu.');
    selected={id:current,home:data.home,away:data.away};$('match').textContent=`${data.home.name} × ${data.away.name}`;
    const feed=data.showControl;if(!feed||!Array.isArray(feed.events)||!feed.types?.length)throw new Error('LIVE kolekce událostí nejsou dostupné. Lze použít ruční test.');
    if(events.some(e=>e.status==='Playing'&&feed.types.includes(e.type)&&!feed.events.some(n=>n.id===e.id&&signature(n)===signature(e))))audio.cancel();
    events=reconcile(events,feed.events,feed.types);persist();liveReady=true;lastRead=Date.now();
    connection(`LIVE HMS · načteno ${new Date().toLocaleTimeString('cs-CZ')} · ${feed.types.map(t=>t==='goal'?'góly':'tresty').join(', ')}${feed.omitted?` · ${feed.omitted} neověřených eventů vynecháno`:''}`,'live');
    render();
    await loadPads();
  }catch(error){if(run!==generation)return;liveReady=false;audio.cancel();connection(`LIVE nedostupné · ${error.message}`);}finally{clearTimeout(timeout);if(run===generation){render();timer=setTimeout(()=>poll(run),15000);}}
}
async function choose(){
  reset();const run=generation;if(mode()==='test'){selected={id:'manual',home:{id:'test-home',name:'Test domácí'},away:{id:'test-away',name:'Test hosté'}};$('match').textContent='RUČNÍ TEST · žádná živá data';connection('TEST · ruční eventy, bez připojení k HMS','test');}
  else{selected=$('game').value?{id:$('game').value}:null;$('match').textContent='Vyberte zápas';connection(selected?'Načítám ověřené LIVE události…':'LIVE zatím není připojeno.');}
  selectionDetails.open=mode()==='live'&&!selected;
  $('testTools').hidden=mode()!=='test';restore();render();await loadPads();if(run===generation&&selected&&mode()==='live')poll(run);
}
const cueTeam=cue=>cue[2]==='HOME'?team('home'):cue[2]==='AWAY'?team('away'):null;
async function resolveAsset(cue,currentOrg){for(const k of profileKeys(currentOrg,cueTeam(cue),cue[3])){const value=await loadStudioAsset(k);if(value?.blob instanceof Blob)return {...value,key:k};}return null;}
async function loadPads(){
  const version=++padVersion,current=org();$('pads').replaceChildren();assets.clear();
  for(const cue of cues){const b=document.createElement('button');b.className='pad';b.dataset.cue=cue[0];const title=document.createElement('strong');title.textContent=cue[1];const side=document.createElement('span');side.textContent=cue[2]||'MIX';const hint=document.createElement('small');hint.textContent='Načítám profil…';b.append(title,side,hint);b.disabled=true;b.onclick=()=>playCue(cue);$('pads').append(b);}
  try{const values=await Promise.all(cues.map(c=>resolveAsset(c,current)));if(version!==padVersion||current!==org())return;values.forEach((asset,i)=>{assets.set(cues[i][0],asset);const b=$('pads').children[i];b.disabled=!asset;b.lastChild.textContent=asset?`${asset.key.includes(':team:')?'Tým':asset.key.includes(':organization:')?'Organizace':'Výchozí'} · ${asset.name}`:'Nenastaveno · nahrajte zvuk';});}catch{if(version===padVersion)notice('Úložiště zvuků není dostupné v tomto prohlížeči.');}
  updateAssetLabel();
}
async function playCue(cue){const asset=assets.get(cue[0]);if(!asset)return;try{await audio.play(asset.blob,['pregame','ingame','victory'].includes(cue[3])?'bed':'effect',{loop:['pregame','ingame'].includes(cue[3]),label:cue[1]+' '+cue[2]});}catch{notice('Zvuk se nepodařilo spustit. Ověřte formát souboru.');}}
function editKey(){const p=$('profile').value,kind=$('kind').value;if(p.startsWith('team-')){const id=team(p.slice(5));if(!id)throw new Error('Nejdříve načtěte zápas nebo zvolte ruční test.');return profileKeys(org(),id,kind)[0];}return `show:v1:${org()}:${p}:${kind}`;}
async function updateAssetLabel(){let k;try{k=editKey();const data=await loadStudioAsset(k);if(k===editKey())$('asset').textContent=data?`V profilu: ${data.name}`:'Profil je prázdný. Použije se organizace nebo výchozí zvuk.';}catch(error){$('asset').textContent=error.message;}}
$('upload').onchange=async()=>{const file=$('upload').files[0];if(!file)return;if(file.size>30*1024*1024||!(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)||file.type.startsWith('audio/')))return notice('Vyberte audio soubor do 30 MB.');try{await saveStudioAsset(editKey(),{blob:file,name:file.name});notice('Zvuk uložen do profilu v tomto prohlížeči.');await loadPads();}catch(error){notice('Zvuk nelze uložit. '+error.message);}finally{$('upload').value='';}};
$('clear').onclick=async()=>{try{await removeStudioAsset(editKey());await loadPads();}catch(error){notice(error.message);}};
$('profile').onchange=updateAssetLabel;$('kind').onchange=updateAssetLabel;
$('stop').onclick=()=>{audio.stop();render();notice('Všechny zvuky a hlasatel zastaveny.');};
$('pause').onclick=()=>{audio.pause();notice('Zvuk i hlasatel pozastaveny.');};$('resume').onclick=()=>audio.resume().then(()=>notice('Přehrávání obnoveno.')).catch(()=>notice('Zvuk nelze obnovit. Zkuste povel znovu.'));
$('volume').oninput=()=>{audio.volume=Number($('volume').value)/100;audio.levels();};$('duck').oninput=()=>{audio.duck=Number($('duck').value)/100;audio.levels();};
$('voiceTest').onclick=()=>{const v=voice();if(!v)return notice('Český hlas není dostupný.');try{audio.speak('Vítejte na dnešním utkání. Hlasatel je připraven.',v,()=>{});}catch(error){notice(error.message);}};
$('mode').onchange=choose;$('game').onchange=choose;$('refresh').onclick=()=>{if(mode()==='test')notice('Ruční test nepoužívá LIVE API.');else choose();};
$('org').onchange=()=>{browseVersion++;reset();selected=null;$('game').replaceChildren(option('','Vyberte zápas'));offset=0;choose();browse();};
$('filter').onchange=()=>{offset=0;browse();};$('browse').onclick=()=>browse();$('previous').onclick=()=>{offset=Math.max(0,offset-20);browse();};$('next').onclick=()=>{offset+=20;browse();};$('count').onchange=render;
function testEvent(edit=false,duplicate=false){if(mode()!=='test')return;const value=$('testText').value.trim();if(!value)return;const old=events.filter(e=>!e.withdrawn).at(-1);if((edit||duplicate)&&!old)return notice('Nejdříve přidejte testovací událost.');const incoming=events.map(e=>({...e}));if(edit){const i=incoming.findIndex(e=>e.id===old.id);incoming[i]={...old,text:value};if(old.status==='Playing')audio.cancel();}else if(!duplicate)incoming.push({id:'test:'+crypto.randomUUID(),type:$('testType').value,side:'home',period:null,clock:null,text:value});events=reconcile(events,incoming,[]);persist();render();notice(duplicate?'Stejné ID přijato znovu · žádný nový event.':edit?'Oprava přijata pod stejným ID.':'Testovací event přidán.');}
$('addTest').onclick=()=>testEvent();$('editTest').onclick=()=>testEvent(true);$('duplicateTest').onclick=()=>testEvent(false,true);
window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.abort();audio.stop();});
async function init(){try{const data=await get('/api/studio?catalog=1');orgs=data.organizations;if(!orgs?.length)throw new Error('Žádná připojená organizace.');$('org').replaceChildren(...orgs.map(o=>option(o.code,o.name)));const requested=new URLSearchParams(location.search).get('org');if(orgs.some(o=>o.code===requested))$('org').value=requested;$('org').disabled=false;await choose();browse();}catch(error){$('org').replaceChildren(option('LOCAL-TEST','Lokální test · bez organizace'));$('mode').value='test';await choose();notice('Katalog organizací není dostupný. '+error.message);}}
init();
