import {studioOrganization,studioUrl} from './routing.js';
import {t as tr,language,setLanguage,translateDocument,filterLabel,insightDescription,insightTitle} from './i18n.js';
import {resolveInsightSubject,brandingScope} from './subjects.js';
import {fonts,formats,designs,gameOutputs,exportFilename,renderGraphic,publicImageUrl,safeArea} from './graphics.js';
import {studioSettingsScope,studioSettingsKey,studioAssetKey,loadStudioAsset,saveStudioAsset,removeStudioAsset} from './preferences.js';
const $=id=>document.getElementById(id);
setLanguage(new URLSearchParams(location.search).get('lang'));translateDocument();$('language').value=language;
let organizations=[];
$('language').onchange=()=>{const url=new URL(location.href);url.searchParams.set('lang',$('language').value);location.assign(url.pathname+url.search);};
window.addEventListener('popstate',()=>location.reload());
const defaults={design:'clean',format:'1:1',font:fonts[0],base:'#0b1c32',accent:'#78e5b8',panelColor:'#10243b',panelOpacity:'90',shade:'30',partner:'',partnerLogo:'',background:''};
let settings={...defaults}, section='games',filter='Today',offset=0,windowPage=0,game=null,insight=null,requestId=0,renderId=0,settingsLoadId=0,blob=null,renderQueue=Promise.resolve();
const assetVersions={background:0,partnerLogo:0,playerPhoto:0,competitionLogo:0,groupLogo:0};
const playerPhotos=new Map();let brandOverrides=new Map(),searchTimer;
function brandKey(kind){return brandingScope($('org').value,game,kind);}
function saveBrands(){try{localStorage.setItem(`hms-studio:brands:v1:${$('org').value}`,JSON.stringify([...brandOverrides]));}catch{status(tr('Logo je použité, ale úložiště zařízení je plné.'));}}
function activeInsight(){return $('template').value==='insight'?insight:gameOutputs(game).find(t=>t.id===$('template').value)?.insight??null;}
function subjectKey(){const s=resolveInsightSubject(game??{},activeInsight());return s?.playerId?`${$('org').value}:${game.gameId}:${s.playerId}`:null;}
function guide(){const r=safeArea(settings.format),h=settings.format==='9:16'?1920:1080,g=$('safeGuide');g.style.left=`${r.x/1080*100}%`;g.style.top=`${r.y/h*100}%`;g.style.width=`${r.w/1080*100}%`;g.style.height=`${r.h/h*100}%`;g.hidden=!game||!$('safeZones').checked;}
const gameStatuses={FINISHED:tr('Ukončeno'),RUNNING:tr('Probíhá · průběžná data'),'NOT PLAYED':tr('Naplánováno')};
const filters=['Today','Yesterday','Tomorrow','-7 days','+7 days','Past','Future'];
fonts.forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=f==='Pantha'?tr('Pantha · anglické titulky'):f;$('font').append(o);});
function status(s){$('status').textContent=s;}
function settingsScope(){
  return studioSettingsScope({hasGame:!!game,choice:$('template').value,insightType:insight?.type});
}
function settingsKey(scope=settingsScope()){return studioSettingsKey($('org').value,scope);}
function settingsAssetKey(kind,scope=settingsScope()){return studioAssetKey(settingsKey(scope),kind);}
function normalizeSettings(stored={}){
  const next={...defaults};
  for(const k of Object.keys(defaults))if(typeof stored[k]==='string')next[k]=stored[k];
  if(!formats[next.format])next.format=defaults.format;if(!fonts.includes(next.font))next.font=defaults.font;
  if(!designs.includes(next.design))next.design='clean';
  for(const k of ['base','accent','panelColor'])if(!/^#[a-f0-9]{6}$/i.test(next[k]))next[k]=defaults[k];
  next.panelOpacity=String(Math.max(0,Math.min(100,Number.isFinite(Number(next.panelOpacity))?Number(next.panelOpacity):90)));
  return next;
}
async function loadSettings(scope=settingsScope()){
  const loadId=++settingsLoadId,key=settingsKey(scope),legacyKey=`hms-studio:v1:${$('org').value}`,defaultKey=settingsKey('default');let sourceKey=null;
  try{
    const legacy=localStorage.getItem(legacyKey);
    const orgDefault=localStorage.getItem(defaultKey);
    const profile=localStorage.getItem(key);
    sourceKey=profile!==null?key:orgDefault!==null?defaultKey:legacy!==null?legacyKey:null;
    settings=normalizeSettings(JSON.parse(profile??orgDefault??legacy??'{}'));
  }catch{settings={...defaults};}
  const migrated={};
  for(const kind of ['background','partnerLogo'])if(settings[kind].startsWith('data:image/')){migrated[kind]=settings[kind];settings[kind]='';}
  if(Object.keys(migrated).length&&sourceKey)try{localStorage.setItem(sourceKey,JSON.stringify(settings));}catch{}
  const stored=await Promise.all(['background','partnerLogo'].map(async kind=>{
    if(migrated[kind]){await saveStudioAsset(studioAssetKey(key,kind),migrated[kind]);return migrated[kind];}
    return loadStudioAsset(studioAssetKey(key,kind));
  })).catch(()=>[null,null]);
  if(loadId!==settingsLoadId)return false;
  if(stored[0])settings.background=stored[0];if(stored[1])settings.partnerLogo=stored[1];
  for(const k of Object.keys(defaults))$(k).value=settings[k].startsWith('data:')?'':settings[k];
  if(Object.keys(migrated).length)save();
  return true;
}
async function editorSettings() {
  try{const entries=JSON.parse(localStorage.getItem(`hms-studio:brands:v1:${$('org').value}`)||'[]');brandOverrides=new Map(entries.filter(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string'&&typeof e[1]==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(e[1])));}catch{brandOverrides=new Map();}
  await loadSettings('default');
}
function save(){try{const light={...settings};for(const kind of ['background','partnerLogo'])if(light[kind].startsWith('data:'))light[kind]='';localStorage.setItem(settingsKey(),JSON.stringify(light));}catch{status(tr('Nastavení je použité. Úložiště zařízení je plné, nelze je uložit.'));}}
function resetSelection(){settingsLoadId++;assetVersions.background++;assetVersions.partnerLogo++;assetVersions.playerPhoto++;assetVersions.competitionLogo++;assetVersions.groupLogo++;$('subjectEditor').hidden=true;$('brandEditor').hidden=true;$('safeGuide').hidden=true;++renderId;game=null;insight=null;blob=null;$('empty').hidden=false;$('selected').textContent=section==='insights'?tr('Vyberte výkon'):tr('Vyberte zápas');$('template').replaceChildren();$('template').disabled=true;$('refresh').disabled=true;$('download').disabled=true;$('share').disabled=true;$('canvas').getContext('2d').clearRect(0,0,$('canvas').width,$('canvas').height);$('warnings').textContent='';}
async function api(params){if(!organizations.some(o=>o.code===$('org').value))throw new Error(tr('Organizace není v tomto Studiu dostupná.'));const r=await fetch('/api/studio?'+new URLSearchParams({org:$('org').value,lang:language,...params}));const data=await r.json();if(!r.ok)throw new Error(data.error||tr('Načtení se nezdařilo.'));return data;}
async function browse(){const id=++requestId;$('list').textContent=tr('Načítám…');$('dataSource').hidden=true;$('next').disabled=true;$('previous').disabled=true;$('windows').hidden=section==='insights'||!['Past','Future'].includes(filter);$('filters').hidden=section==='insights';$('insightTools').hidden=section!=='insights';
  try{const data=await api({section,filter,offset,windowPage,...(section==='insights'?{query:$('search').value,type:$('insightType').value}:{})});if(id!==requestId)return;
    $('list').replaceChildren();$('list').dataset.section=section;$('range').textContent=section==='insights'?tr('Knihovna odehraných zápasů · nejnovější první'):`${data.from} – ${data.to} · Europe/Prague`;
    const importedOnly=section==='games'&&data.source==='imported-snapshot';
    $('dataSource').hidden=section!=='games';
    $('dataSource').textContent=importedOnly?tr('Pouze importované zápasy. Živý seznam HMS není v tomto nasazení připojen; dnešní a plánované zápasy mohou chybět.'):data.source==='HMS'?tr('Živý seznam HMS · Studio neomezuje stav zápasu.'):tr('Zdroj seznamu není potvrzen.');
    for(const item of data.items){
      const b=document.createElement('button');b.className='match';
      const date=document.createElement('small');date.textContent=`${item.playedOn??item.date} · ${section==='games'?(gameStatuses[item.status]??item.status??tr('Neznámý stav')):item.type}`;
      const title=document.createElement('strong');
      title.textContent=section==='insights'?`${insightTitle(item)} · ${item.player||item.team||tr('Týmový výkon')}`:item.labelsAvailable===false?tr('Názvy týmů nejsou dostupné · {id}',{id:item.gameId.slice(0,8)}):`${item.home.name} × ${item.away.name}`;
      const logos=document.createElement('span');logos.className='match-logos';
      const urls=section==='insights'?[item.playerImageUrl,item.teamLogoUrl]:[item.home.logoUrl,item.away.logoUrl];
      for(const url of urls)if(url){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.src='/api/studio-image?'+new URLSearchParams({url});img.onerror=()=>img.remove();logos.append(img);}
      b.append(logos,date,title);
      if(section==='insights'){
        const detail=document.createElement('span');detail.className='insight-description';detail.textContent=insightDescription(item);
        const context=document.createElement('small');context.className='insight-context';context.textContent=`${item.team||''} · ${item.homeTeam||'?'} ${item.homeScore??'–'}:${item.awayScore??'–'} ${item.awayTeam||'?'} · ${item.group||item.competition||''}`;
        b.append(detail,context);
      }
      b.onclick=()=>select(item.gameId,section==='insights'?item:null);$('list').append(b);
    }
    if(!data.items.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=section==='insights'?tr('Žádné výkony neodpovídají hledání.'):importedOnly?tr('V uložených importech nejsou pro období {from} – {to} žádné zápasy. To neznamená, že v HMS nejsou naplánované.',data):tr('HMS pro období {from} – {to} nevrátilo žádné zápasy.',data);$('list').append(empty);}
    $('next').disabled=!data.hasMore;$('previous').disabled=offset===0;$('windowPrev').disabled=windowPage===0;
  }catch(e){if(id===requestId){$('list').textContent=e.message;$('range').textContent=tr('Data nejsou připojena nebo zdroj neodpovídá organizaci.');}}
}
async function select(id,selectedInsight=null,refresh=false){const version=++requestId,org=$('org').value;blob=null;$('download').disabled=true;$('share').disabled=true;$('refresh').disabled=true;status(tr('Načítám ověřená data zápasu…'));
  try{const result=await api({gameId:id,...(refresh?{refresh:'1'}:{})});if(version!==requestId||org!==$('org').value)return;game=result;insight=selectedInsight;assetVersions.playerPhoto++;
    const subject=resolveInsightSubject(game,insight);$('subjectEditor').hidden=!subject?.playerId;
    $('brandEditor').hidden=false;$('brandInfo').textContent=tr('{competition} · {group}. Automaticky z HMS; doplnění se ukládá jen v tomto zařízení pro danou soutěž/skupinu.',{competition:game.competition||'',group:game.group||''});
    $('subjectInfo').textContent=subject?`${subject.playerName||''} · ${subject.teamName||tr('Neověřený tým')} · ${game.playedOn}`:'';
    $('selected').textContent=insight?`${insightTitle(insight)} · ${subject?.playerName||subject?.teamName||insight.player||insight.team}`:`${game.home.name} × ${game.away.name}`;$('empty').hidden=true;
    const choices=gameOutputs(game);$('template').replaceChildren();
    for(const t of choices){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('template').append(o);}
    if(insight&&game.status==='FINISHED'){const o=document.createElement('option');o.value='insight';o.textContent=insightTitle(insight);$('template').append(o);$('template').value='insight';}
    await loadSettings();
    if(game.groupColor&&settings.accent===defaults.accent)settings.accent=game.groupColor;
    $('accent').value=settings.accent;
    $('template').disabled=!$('template').options.length;$('refresh').disabled=false;
    $('availability').textContent=choices.length?tr('Skóre po třetině je průběžné, pouze z ověřených událostí.'):tr('Šablony výsledku čekají na dokončení zápasu nebo ověřená skóre třetin.');
    status(`${game.source==='imported-snapshot'?tr('Uložená data HMS'):game.source==='HMS-read-only'?tr('Obnoveno z HMS'):tr('Testovací data')} · ${tr('načteno')} ${new Date(game.readAt).toLocaleTimeString(language==='en'?'en-GB':'cs-CZ',{timeZone:'Europe/Prague'})}`);
    await draw();
  }catch(e){if(version===requestId){resetSelection();status(e.message);}}
}
function draw(){const id=++renderId,selectedGame=game,selectedInsight=insight,s={...settings,lang:language,playerPhoto:playerPhotos.get(subjectKey())??'',competitionLogo:brandOverrides.get(brandKey('competitionLogo'))??'',groupLogo:brandOverrides.get(brandKey('groupLogo'))??''},choice=$('template').value;blob=null;$('download').disabled=true;$('share').disabled=true;
  renderQueue=renderQueue.catch(()=>{}).then(async()=>{if(id!==renderId||!selectedGame)return;
    $('availability').textContent=(choice==='insight'||choice.startsWith('moment-')||choice.startsWith('star-'))?tr('Uložený výkon nebo oficiální hvězda HMS. Fotografie a tým patří k hráči v tomto zápase.'):tr('Skóre po třetině je průběžné, pouze z ověřených událostí.');
    const t=gameOutputs(selectedGame).find(t=>t.id===choice);if((choice==='insight'&&selectedGame.status!=='FINISHED')||(!t&&choice!=='insight')){status(selectedGame.status==='NOT PLAYED'?tr('Zápas je naplánovaný. Zpětné grafiky budou dostupné po ukončení.'):selectedGame.status==='RUNNING'?tr('Zápas probíhá. Konec třetiny vyžaduje ověřenou ukončenou třetinu; zpětné grafiky čekají na ukončení zápasu.'):tr('Pro tento stav zápasu není výstup dostupný.'));return;}
    const outputInsight=choice==='insight'?selectedInsight:t?.insight;
    const offscreen=document.createElement('canvas');
    try{const warnings=await renderGraphic(offscreen,selectedGame,t??{},s,outputInsight);const png=await new Promise((resolve,reject)=>offscreen.toBlob(b=>b?resolve(b):reject(new Error(tr('PNG se nepodařilo vytvořit.'))),'image/png'));
      if(id!==renderId)return;const c=$('canvas');c.width=offscreen.width;c.height=offscreen.height;c.getContext('2d').drawImage(offscreen,0,0);blob=png;$('warnings').textContent=warnings.join(' ');$('download').disabled=false;guide();
      const f=new File([blob],'hms.png',{type:'image/png'});$('share').disabled=!navigator.canShare?.({files:[f]});
    }catch(e){if(id===renderId){$('warnings').textContent=e.message;status(tr('Export čeká na opravu obrázku.'));}}
  });return renderQueue;
}
$('org').onchange=async()=>{const org=organizations.find(o=>o.code===$('org').value);if(!org)return;history.pushState(null,'',studioUrl(org,language));++requestId;resetSelection();await editorSettings();offset=0;windowPage=0;browse();};
for(const name of ['games','insights'])$(name).onclick=()=>{section=name;offset=0;resetSelection();for(const n of ['games','insights'])$(n).setAttribute('aria-pressed',String(n===name));browse();};
for(const f of filters){const b=document.createElement('button');b.textContent=filterLabel(f);b.dataset.filter=f;b.setAttribute('aria-pressed',String(f===filter));b.onclick=()=>{filter=f;offset=0;windowPage=0;for(const child of $('filters').children)child.setAttribute('aria-pressed',String(child===b));browse();};$('filters').append(b);}
$('previous').onclick=()=>{offset=Math.max(0,offset-20);browse();};$('next').onclick=()=>{offset+=20;browse();};
$('windowPrev').onclick=()=>{windowPage=Math.max(0,windowPage-1);offset=0;browse();};$('windowNext').onclick=()=>{windowPage++;offset=0;browse();};
$('refresh').onclick=()=>game&&select(game.gameId,insight,true);$('template').onchange=async()=>{if(!await loadSettings())return;if(game?.groupColor&&settings.accent===defaults.accent){settings.accent=game.groupColor;$('accent').value=settings.accent;}const subject=resolveInsightSubject(game,activeInsight());$('subjectEditor').hidden=!subject?.playerId;$('subjectInfo').textContent=subject?`${subject.playerName||''} · ${subject.teamName||tr('Neověřený tým')} · ${game.playedOn}`:'';draw();};
$('safeZones').onchange=guide;
$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;if(section==='insights')browse();},300);};
$('insightType').onchange=()=>{offset=0;browse();};
$('settings').onsubmit=e=>e.preventDefault();
for(const key of Object.keys(defaults))$(key).onchange=()=>{const v=$(key).value;
  if(['background','partnerLogo'].includes(key)&&v&&!publicImageUrl(v)){blob=null;$('download').disabled=true;$('share').disabled=true;status(tr('Použijte veřejnou HTTPS URL bez přihlašovacích údajů.'));return;}
  if(settings[key]===v){if(game&&!blob)draw();return;}
  if(key in assetVersions)assetVersions[key]++;
  if(['background','partnerLogo'].includes(key))removeStudioAsset(settingsAssetKey(key)).catch(()=>{});
  settings[key]=v;save();draw();};
for(const key of ['partner','shade','base','accent','panelColor','panelOpacity','background','partnerLogo'])$(key).oninput=$(key).onchange;
async function upload(event,key){const file=event.target.files[0];if(!file)return;
  const org=$('org').value,photoKey=key==='playerPhoto'?subjectKey():null,brandingKey=['competitionLogo','groupLogo'].includes(key)?brandKey(key):null,assetVersion=++assetVersions[key];
  ++renderId;blob=null;$('download').disabled=true;$('share').disabled=true;
  if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){status(tr('Nahrajte PNG/JPG/WebP do 8 MB.'));return;}
  try{const image=await createImageBitmap(file);if(image.width*image.height>40000000){image.close();throw new Error();}
    const c=document.createElement('canvas'),scale=Math.min(1,1920/Math.max(image.width,image.height));c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);image.close();
    if(org!==$('org').value||assetVersion!==assetVersions[key])return;const data=c.toDataURL('image/png');if(key==='playerPhoto'){if(photoKey!==subjectKey())return;playerPhotos.set(photoKey,data);}else if(brandingKey){if(brandingKey!==brandKey(key))return;brandOverrides.set(brandingKey,data);saveBrands();}else{await saveStudioAsset(settingsAssetKey(key),data);settings[key]=data;$(key).value='';save();}draw();
  }catch{status(tr('Obrázek se nepodařilo otevřít nebo uložit.'));}}
$('upload').onchange=e=>upload(e,'background');$('partnerUpload').onchange=e=>upload(e,'partnerLogo');$('playerUpload').onchange=e=>upload(e,'playerPhoto');$('competitionUpload').onchange=e=>upload(e,'competitionLogo');$('groupUpload').onchange=e=>upload(e,'groupLogo');
$('clearBrands').onclick=()=>{for(const key of ['competitionLogo','groupLogo']){assetVersions[key]++;brandOverrides.delete(brandKey(key));}$('competitionUpload').value='';$('groupUpload').value='';saveBrands();draw();};
$('clearPlayer').onclick=()=>{assetVersions.playerPhoto++;playerPhotos.delete(subjectKey());$('playerUpload').value='';draw();};
$('clearBackground').onclick=()=>{assetVersions.background++;removeStudioAsset(settingsAssetKey('background')).catch(()=>{});settings.background='';$('background').value='';$('upload').value='';save();draw();};
$('clearPartner').onclick=()=>{assetVersions.partnerLogo++;removeStudioAsset(settingsAssetKey('partnerLogo')).catch(()=>{});settings.partnerLogo='';$('partnerLogo').value='';$('partnerUpload').value='';save();draw();};
function exportFile(){return new File([blob],exportFilename(game,gameOutputs(game).find(t=>t.id===$('template').value),settings,activeInsight()),{type:'image/png'});}
$('download').onclick=()=>{if(!blob)return;const f=exportFile(),url=URL.createObjectURL(f),a=document.createElement('a');a.href=url;a.download=f.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
$('share').onclick=async()=>{if(!blob)return;try{await navigator.share({files:[exportFile()],title:'HMS Media Studio'});}catch(e){if(e.name!=='AbortError')status(tr('Sdílení není dostupné. Použijte Stáhnout PNG.'));}};
async function initialize(){
  try{
    const response=await fetch('/api/studio?'+new URLSearchParams({catalog:'1',lang:language}));
    if(!response.ok)throw new Error();const data=await response.json();
    if(!Array.isArray(data.organizations)||!data.organizations.length)throw new Error();
    organizations=data.organizations;
    $('org').replaceChildren();for(const org of organizations){const option=document.createElement('option');option.value=org.code;option.textContent=org.name+(org.configured?'':` · ${tr('Nepřipojeno')}`);$('org').append(option);}
    $('org').disabled=false;
    const org=studioOrganization(location.pathname,organizations);if(!org){$('org').value='';resetSelection();$('list').textContent=tr('Organizace není v tomto Studiu dostupná.');status(tr('Organizace není v tomto Studiu dostupná.'));return;}
    $('org').value=org.code;history.replaceState(null,'',studioUrl(org,language));await editorSettings();await browse();
  }catch{status(tr('Seznam organizací nelze načíst. Zkuste stránku obnovit.'));$('list').textContent=tr('Seznam organizací nelze načíst. Zkuste stránku obnovit.');}
}
initialize();
