import {fonts,formats,templates,renderGraphic,publicImageUrl} from './graphics.js';
const $=id=>document.getElementById(id);
const defaults={format:'1:1',font:fonts[0],base:'#0b1c32',accent:'#78e5b8',shade:'30',partner:'',partnerLogo:'',background:''};
let settings={...defaults}, section='games',filter='Today',offset=0,windowPage=0,game=null,insight=null,requestId=0,renderId=0,blob=null,renderQueue=Promise.resolve();
const assetVersions={background:0,partnerLogo:0};
const filters=['Today','Yesterday','Tomorrow','-7 days','+7 days','Past','Future'];
fonts.forEach(f=>{const o=document.createElement('option');o.textContent=f;$('font').append(o);});
function status(s){$('status').textContent=s;}
function editorSettings() {
  try {const s=JSON.parse(localStorage.getItem(`hms-studio:v1:${$('org').value}`)||'{}');settings={...defaults};
    for(const k of Object.keys(defaults))if(typeof s[k]==='string')settings[k]=s[k];
    if(!formats[settings.format])settings.format=defaults.format;if(!fonts.includes(settings.font))settings.font=defaults.font;
    for(const k of ['base','accent'])if(!/^#[a-f0-9]{6}$/i.test(settings[k]))settings[k]=defaults[k];
  }catch{settings={...defaults};}
  for(const k of Object.keys(defaults))$(k).value=settings[k].startsWith('data:')?'':settings[k];
}
function save(){try{localStorage.setItem(`hms-studio:v1:${$('org').value}`,JSON.stringify(settings));}catch{status('Nastavení je použité. Úložiště zařízení je plné, nelze je uložit.');}}
function resetSelection(){assetVersions.background++;assetVersions.partnerLogo++;++renderId;game=null;insight=null;blob=null;$('empty').hidden=false;$('selected').textContent='Vyberte zápas';$('template').replaceChildren();$('template').disabled=true;$('refresh').disabled=true;$('download').disabled=true;$('share').disabled=true;$('canvas').getContext('2d').clearRect(0,0,$('canvas').width,$('canvas').height);$('warnings').textContent='';}
async function api(params){const r=await fetch('/api/studio?'+new URLSearchParams({org:$('org').value,...params}));const data=await r.json();if(!r.ok)throw new Error(data.error||'Načtení se nezdařilo.');return data;}
async function browse(){const id=++requestId;$('list').textContent='Načítám…';$('next').disabled=true;$('previous').disabled=true;$('windows').hidden=!['Past','Future'].includes(filter);
  try{const data=await api({section,filter,offset,windowPage});if(id!==requestId)return;
    $('list').replaceChildren();$('range').textContent=`${data.from} – ${data.to} · Europe/Prague · ${data.source}`;
    for(const item of data.items){const b=document.createElement('button');b.className='match';const date=document.createElement('small');date.textContent=`${item.playedOn??item.date} · ${item.status??item.type}`;const title=document.createElement('strong');title.textContent=section==='insights'?item.title:item.labelsAvailable===false?`Názvy týmů nejsou dostupné · ${item.gameId.slice(0,8)}`:`${item.home.name} × ${item.away.name}`;
      if(section==='games'){const logos=document.createElement('span');logos.className='match-logos';for(const side of [item.home,item.away])if(side.logoUrl){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.src='/api/studio-image?'+new URLSearchParams({url:side.logoUrl});img.onerror=()=>img.remove();logos.append(img);}b.append(logos);}
      b.append(date,title);b.onclick=()=>select(item.gameId,section==='insights'?item:null);$('list').append(b);}
    $('next').disabled=!data.hasMore;$('previous').disabled=offset===0;$('windowPrev').disabled=windowPage===0;
  }catch(e){if(id===requestId){$('list').textContent=e.message;$('range').textContent='Data nejsou připojena nebo zdroj neodpovídá organizaci.';}}
}
async function select(id,selectedInsight=null,refresh=false){const version=++requestId,org=$('org').value;blob=null;$('download').disabled=true;$('share').disabled=true;$('refresh').disabled=true;status('Načítám ověřená data zápasu…');
  try{const result=await api({gameId:id,...(refresh?{refresh:'1'}:{})});if(version!==requestId||org!==$('org').value)return;game=result;insight=selectedInsight;
    if(game.groupColor&&settings.accent===defaults.accent)settings.accent=game.groupColor;
    $('accent').value=settings.accent;
    $('selected').textContent=`${game.home.name} × ${game.away.name}`;$('empty').hidden=true;
    const choices=templates(game);$('template').replaceChildren();
    for(const t of choices){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('template').append(o);}
    if(insight){const o=document.createElement('option');o.value='insight';o.textContent=insight.title;$('template').append(o);$('template').value='insight';}
    $('template').disabled=!$('template').options.length;$('refresh').disabled=false;
    $('availability').textContent=choices.length?'Skóre po třetině je průběžné, pouze z ověřených událostí.':'Šablony výsledku čekají na dokončení zápasu nebo ověřená skóre třetin.';
    status(`Zdroj: ${game.source} · načteno ${new Date(game.readAt).toLocaleTimeString('cs-CZ')}`);
    await draw();
  }catch(e){if(version===requestId){resetSelection();status(e.message);}}
}
function draw(){const id=++renderId,selectedGame=game,selectedInsight=insight,s={...settings},choice=$('template').value;blob=null;$('download').disabled=true;$('share').disabled=true;
  renderQueue=renderQueue.catch(()=>{}).then(async()=>{if(id!==renderId||!selectedGame)return;
    const t=templates(selectedGame).find(t=>t.id===choice);if(!t&&choice!=='insight'){status('Pro tento stav zápasu není výstup dostupný.');return;}
    const offscreen=document.createElement('canvas');
    try{const warnings=await renderGraphic(offscreen,selectedGame,t??{},s,choice==='insight'?selectedInsight:null);const png=await new Promise((resolve,reject)=>offscreen.toBlob(b=>b?resolve(b):reject(new Error('PNG se nepodařilo vytvořit.')),'image/png'));
      if(id!==renderId)return;const c=$('canvas');c.width=offscreen.width;c.height=offscreen.height;c.getContext('2d').drawImage(offscreen,0,0);blob=png;$('warnings').textContent=warnings.join(' ');$('download').disabled=false;
      const f=new File([blob],'hms.png',{type:'image/png'});$('share').disabled=!navigator.canShare?.({files:[f]});
    }catch(e){if(id===renderId){$('warnings').textContent=e.message;status('Export čeká na opravu obrázku.');}}
  });return renderQueue;
}
$('org').onchange=()=>{++requestId;resetSelection();editorSettings();offset=0;windowPage=0;browse();};
for(const name of ['games','insights'])$(name).onclick=()=>{section=name;offset=0;for(const n of ['games','insights'])$(n).setAttribute('aria-pressed',String(n===name));browse();};
for(const f of filters){const b=document.createElement('button');b.textContent=f;b.setAttribute('aria-pressed',String(f===filter));b.onclick=()=>{filter=f;offset=0;windowPage=0;for(const child of $('filters').children)child.setAttribute('aria-pressed',String(child===b));browse();};$('filters').append(b);}
$('previous').onclick=()=>{offset=Math.max(0,offset-20);browse();};$('next').onclick=()=>{offset+=20;browse();};
$('windowPrev').onclick=()=>{windowPage=Math.max(0,windowPage-1);offset=0;browse();};$('windowNext').onclick=()=>{windowPage++;offset=0;browse();};
$('refresh').onclick=()=>game&&select(game.gameId,insight,true);$('template').onchange=draw;
$('settings').onsubmit=e=>e.preventDefault();
for(const key of Object.keys(defaults))$(key).onchange=()=>{const v=$(key).value;
  if(['background','partnerLogo'].includes(key)&&v&&!publicImageUrl(v)){status('Použijte veřejnou HTTPS URL bez přihlašovacích údajů.');return;}
  if(key in assetVersions)assetVersions[key]++;
  settings[key]=v;save();draw();};
async function upload(event,key){const file=event.target.files[0];if(!file)return;
  const org=$('org').value,assetVersion=++assetVersions[key];
  ++renderId;blob=null;$('download').disabled=true;$('share').disabled=true;
  if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Nahrajte PNG/JPG/WebP do 8 MB.');return;}
  try{const image=await createImageBitmap(file);if(image.width*image.height>40000000){image.close();throw new Error();}
    const c=document.createElement('canvas'),scale=Math.min(1,1920/Math.max(image.width,image.height));c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);image.close();
    if(org!==$('org').value||assetVersion!==assetVersions[key])return;settings[key]=c.toDataURL('image/png');$(key).value='';save();draw();
  }catch{status('Obrázek se nepodařilo otevřít.');}}
$('upload').onchange=e=>upload(e,'background');$('partnerUpload').onchange=e=>upload(e,'partnerLogo');
$('clearBackground').onclick=()=>{assetVersions.background++;settings.background='';$('background').value='';$('upload').value='';save();draw();};
$('clearPartner').onclick=()=>{assetVersions.partnerLogo++;settings.partnerLogo='';$('partnerLogo').value='';$('partnerUpload').value='';save();draw();};
function exportFile(){return new File([blob],`HMS-${$('org').value}-${game.gameId}-${$('template').value}-${settings.format.replace(':','x')}.png`,{type:'image/png'});}
$('download').onclick=()=>{if(!blob)return;const f=exportFile(),url=URL.createObjectURL(f),a=document.createElement('a');a.href=url;a.download=f.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
$('share').onclick=async()=>{if(!blob)return;try{await navigator.share({files:[exportFile()],title:'HMS Media Studio'});}catch(e){if(e.name!=='AbortError')status('Sdílení není dostupné. Použijte Stáhnout PNG.');}};
editorSettings();browse();
