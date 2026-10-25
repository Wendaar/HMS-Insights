const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const managing=location.pathname.startsWith('/control/'),segments=location.pathname.split('/').filter(Boolean);
const org=(managing?(params.get('org')??'phm'):(segments[2]??'phm')).toLowerCase();
let slug=managing?(params.get('instance')??'phm-cup-2026'):(segments[3]??'phm-cup-2026');
let secret='',instance=null,storageReady=false,dirty=false,busy=false,data=null,loadId=0;
let visibleLimit=60;
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const plural=new Intl.PluralRules('cs');
const unit=(value,one,few,other)=>({one,few,other}[plural.select(value)]??other);
const publicPath=()=>`/tools/playoff-players/${encodeURIComponent(org)}/${encodeURIComponent(slug)}`;
const mappingLabels={id:'ID hráče',name:'Celé jméno',firstName:'Jméno',lastName:'Příjmení',team:'Název týmu',teamId:'ID týmu',starts:'Počet startů',goals:'Góly',assists:'Asistence',level:'Úroveň hráče',photo:'Fotografie hráče',teamLogo:'Logo týmu',competition:'Soutěž',season:'Sezona',group:'Skupina',phase:'Fáze'};
document.body.classList.toggle('manage',managing);document.body.classList.toggle('embed',!managing&&params.get('embed')==='1');
document.documentElement.classList.toggle('embed',!managing&&params.get('embed')==='1');
$('manager').hidden=!managing;$('viewer').hidden=managing;$('public-link').hidden=!managing;
$('org-label').textContent=org.toUpperCase();
function links(){
  const path=publicPath();$('public-link').href=path;
  const url=new URL(path,location.origin);$('share-url').href=url.href;$('share-url').textContent=url.href;
  url.searchParams.set('embed','1');$('embed-code').value=`<iframe src="${url.href}" title="Hráči do playoff" width="100%" height="1100" style="border:0" loading="lazy"></iframe>`;
}
async function api(action,body){
  const response=await fetch('/api/tools?'+new URLSearchParams({org,instance:slug,action}),{method:body?'POST':'GET',headers:{...(secret?{authorization:'Bearer '+secret}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json();}catch{throw new Error('Server nevrátil očekávanou odpověď. Zkuste to znovu.');}
  if(!response.ok)throw new Error(result.error||'Požadavek se nezdařil.');return result;
}
function adminMessage(message,error=false){$('admin-message').textContent=message;$('admin-message').classList.toggle('error',error);}
function updateActions(){
  $('settings').inert=busy;
  $('save').disabled=busy||!storageReady;$('preview').disabled=busy;$('publish').disabled=busy||dirty||!instance?.revision||!storageReady;
  $('duplicate').disabled=busy||dirty||!storageReady;$('instance').disabled=busy;
  $('save-state').textContent=dirty?'Neuložené změny · veřejný výstup zůstává beze změny.':instance?`Pracovní verze uložená · revize ${instance.revision}`:'';
}
function readConfig(){
  let id=$('spreadsheet').value.trim();const match=/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([-\w]+)/.exec(id);if(match)id=match[1];
  return {title:$('title').value,competition:$('competition').value,season:$('season').value,minStarts:Number($('min-starts').value),accent:$('accent').value,
    showPoints:$('show-points').checked,showPhotos:$('show-photos').checked,
    source:{type:'google-sheet',spreadsheetId:id,sheetName:$('sheet').value,mapping:Object.fromEntries(Object.keys(mappingLabels).map(key=>[key,$('map-'+key).value])),
      filters:Object.fromEntries(['competition','season','phase'].map(key=>[key,$('filter-'+key).value]))}};
}
function writeConfig(config){
  for(const key of ['title','competition','season','accent'])$(key).value=config[key];
  $('min-starts').value=config.minStarts;$('show-points').checked=config.showPoints;$('show-photos').checked=config.showPhotos;
  $('spreadsheet').value=config.source.spreadsheetId;$('sheet').value=config.source.sheetName;
  for(const key of Object.keys(mappingLabels))$('map-'+key).value=config.source.mapping[key]??'';
  for(const key of ['competition','season','phase'])$('filter-'+key).value=config.source.filters[key]??'';
}
for(const [key,label] of Object.entries(mappingLabels)){
  const div=node('div'),l=node('label',label);l.htmlFor='map-'+key;const input=node('input');input.id='map-'+key;input.maxLength=80;input.placeholder='Automaticky';input.setAttribute('list','source-headers');div.append(l,input);$('mapping').append(div);
}
function applyInstance(value){
  instance=value;dirty=false;writeConfig(instance.draft);updateActions();
  $('publication-state').textContent=instance.published?(instance.publishedAt?`Publikováno ${new Date(instance.publishedAt).toLocaleString('cs-CZ')}.`:'Původní přehled je dostupný na veřejné adrese.'):'Tento výstup zatím není publikovaný.';
}
async function loadManager(){
  const result=await api('manage');storageReady=result.storageReady;
  if(!result.instance)throw new Error('Tento výstup neexistuje. Otevřete původní sezonu a vytvořte z ní nový výstup.');
  $('instance').replaceChildren();for(const item of result.list){const option=node('option',`${item.title}${item.published?'':' · pracovní verze'}`);option.value=item.slug;$('instance').append(option);}
  $('instance').value=slug;applyInstance(result.instance);$('access').hidden=true;$('editor').hidden=false;
  $('storage-state').textContent=storageReady?'Nastavení se ukládá centrálně pro všechny správce.':'Centrální ukládání není připojeno. Ověření dat a náhled můžete používat; uložení a publikace čekají na databázi.';
  links();
}
async function runAdmin(work){
  if(busy)return;busy=true;updateActions();adminMessage('Pracuji…');
  try{await work();}catch(error){adminMessage(error.message,true);}finally{busy=false;updateActions();}
}
$('unlock-form').onsubmit=event=>{event.preventDefault();secret=$('secret').value;$('secret').value='';runAdmin(async()=>{await loadManager();adminMessage('Správa je odemčená. Ověřte data nebo upravte pracovní verzi.');});};
$('settings').oninput=()=>{dirty=true;if(data)$('preview-label').textContent='Náhled z posledního ověření · po změně nastavení ověřte data znovu';updateActions();};
$('settings').onsubmit=event=>{event.preventDefault();runAdmin(async()=>{const result=await api('save',{config:readConfig(),revision:instance.revision});applyInstance(result.instance);adminMessage('Pracovní verze je uložená. Veřejný výstup se nezměnil.');});};
$('preview').onclick=()=>runAdmin(async()=>{
  if(!$('settings').reportValidity())return;
  const result=await api('preview',{config:readConfig()});renderData(result);$('viewer').hidden=false;$('preview-label').hidden=false;$('preview-label').textContent='Pracovní náhled · změny ještě nejsou zveřejněné';
  $('source-headers').replaceChildren(...result.headers.map(header=>{const option=node('option');option.value=header;return option;}));
  adminMessage(`Zdroj je připojený. Náhled obsahuje ${result.players.length} hráčů; veřejný výstup se nezměnil.`);
});
$('publish').onclick=()=>runAdmin(async()=>{const result=await api('publish',{revision:instance.revision});applyInstance(result.instance);adminMessage('Uložené nastavení je publikované na stálé veřejné adrese.');});
$('instance').onchange=()=>{
  if(dirty&&!confirm('Zahodit neuložené změny a otevřít jiný výstup?')){$('instance').value=slug;return;}
  slug=$('instance').value;const url=new URL(location.href);url.searchParams.set('instance',slug);history.replaceState(null,'',url);$('viewer').hidden=true;runAdmin(async()=>{await loadManager();adminMessage('Výstup je načtený.');});
};
$('lock').onclick=()=>location.reload();
$('duplicate').onclick=()=>{$('new-title').value='';$('new-slug').value='';$('duplicate-error').textContent='';$('duplicate-dialog').showModal();};
$('cancel-duplicate').onclick=()=>$('duplicate-dialog').close();
$('duplicate-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;updateActions();
  try{const result=await api('duplicate',{slug:$('new-slug').value,title:$('new-title').value});slug=result.slug;const url=new URL(location.href);url.searchParams.set('instance',slug);history.replaceState(null,'',url);await loadManager();$('duplicate-dialog').close();$('viewer').hidden=true;adminMessage('Nová pracovní verze je připravená. Upravte zdroj a sezonní filtry před publikací.');}
  catch(error){$('duplicate-error').textContent=error.message;}finally{busy=false;updateActions();}
};
$('copy-embed').onclick=async()=>{try{await navigator.clipboard.writeText($('embed-code').value);adminMessage('Kód pro vložení je zkopírovaný.');}catch{$('embed-code').focus();$('embed-code').select();adminMessage('Označený kód zkopírujte pomocí Ctrl+C.');}};
function renderPlayers(reset=true){
  if(reset)visibleLimit=60;
  if(!data)return;const team=$('team-filter').value,search=fold($('player-search').value),status=$('eligibility-filter').value;
  const filtered=data.players.filter(p=>(team==='all'||p.teamId===team)&&(status==='all'||p.eligibility===status)&&(!search||fold(p.name+' '+p.team).includes(search)));
  $('players').replaceChildren();$('result-count').textContent=`Zobrazeno ${Math.min(visibleLimit,filtered.length)} z ${filtered.length} odpovídajících hráčů · celkem ${data.players.length}`;$('no-players').hidden=!!filtered.length;$('more-players').hidden=filtered.length<=visibleLimit;
  for(const p of filtered.slice(0,visibleLimit)){
    const article=node('article',undefined,'player'),header=node('div',undefined,'player-header');
    const initials=node('span',p.name.split(' ').map(s=>s[0]).slice(0,2).join(''),'avatar');
    if(p.photo&&data.config.showPhotos){const photo=node('img');photo.src=p.photo;photo.className='avatar';photo.alt='';photo.loading='lazy';photo.referrerPolicy='no-referrer';photo.onerror=()=>photo.replaceWith(initials);header.append(photo);}else header.append(initials);
    const info=node('div');info.append(node('h3',p.name));const teamLabel=node('p',undefined,'team');
    if(p.teamLogo&&data.config.showPhotos){const img=node('img');img.src=p.teamLogo;img.className='team-logo';img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();teamLabel.append(img);}
    teamLabel.append(document.createTextNode(p.team));info.append(teamLabel);header.append(info);
    const meta=[p.group,p.level,...(data.config.showPoints?[p.points===null?'Body neověřeny':`${p.points} ${unit(p.points,'bod','body','bodů')}`]:[])].filter(Boolean).join(' · ');
    const bottom=node('div',undefined,'player-bottom'),starts=node('div',undefined,'starts');starts.append(node('strong',p.starts??'—'),node('span',p.starts===null?'startů':unit(p.starts,'start','starty','startů')));
    bottom.append(starts,node('span',{eligible:'Splňuje limit',below:'Pod limitem',unknown:'Nelze ověřit'}[p.eligibility],`badge ${p.eligibility}`));article.append(header,node('p',meta,'player-meta'),bottom);$('players').append(article);
  }
}
function renderData(result){
  const selectedTeam=$('team-filter').value;data=result;
  document.documentElement.style.setProperty('--accent',data.config.accent);
  if(!managing)document.title=data.config.title+' · HMS';
  $('view-title').textContent=data.config.title;$('view-subtitle').textContent=[data.config.competition,data.config.season,org.toUpperCase()].filter(Boolean).join(' · ');
  $('rule-label').textContent=`Minimální počet startů: ${data.config.minStarts}`;
  $('data-label').textContent=`${data.sourceLabel} · načteno ${new Date(data.readAt).toLocaleString('cs-CZ')}`;
  $('warnings').hidden=!data.warnings.length;$('warnings').textContent=data.warnings.join(' ');$('data-error').hidden=true;$('results').hidden=false;
  const counts=[['Hráčů v přehledu',data.players.length],['Splňují limit',data.players.filter(p=>p.eligibility==='eligible').length],['Pod limitem',data.players.filter(p=>p.eligibility==='below').length],['Nelze ověřit',data.players.filter(p=>p.eligibility==='unknown').length]];
  $('summary').replaceChildren(...counts.map(([label,value])=>{const div=node('div',undefined,'metric');div.append(node('strong',value),node('span',label));return div;}));
  const teams=[...new Map(data.players.map(p=>[p.teamId,p.team])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'cs'));
  $('team-filter').replaceChildren();const all=node('option','Všechny týmy');all.value='all';$('team-filter').append(all);
  for(const [id,name] of teams){const option=node('option',name);option.value=id;$('team-filter').append(option);}
  if(teams.some(([id])=>id===selectedTeam))$('team-filter').value=selectedTeam;renderPlayers();
}
async function loadPublic(){
  const id=++loadId;$('refresh').disabled=true;
  try{const result=await api('public');if(id!==loadId)return;renderData(result);}
  catch(error){if(id!==loadId)return;$('data-error').textContent=error.message+(data?' Zobrazená data jsou z posledního úspěšného načtení.':'');$('data-error').hidden=false;if(!data)$('data-label').textContent='Zdroj se nepodařilo načíst.';}
  finally{if(id===loadId)$('refresh').disabled=false;}
}
$('player-search').oninput=renderPlayers;$('team-filter').onchange=renderPlayers;$('eligibility-filter').onchange=renderPlayers;
$('more-players').onclick=()=>{visibleLimit+=60;renderPlayers(false);};
$('refresh').onclick=()=>managing?$('preview').click():loadPublic();
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
links();if(!managing){
  // Public output contains only the sporting tool; management is a separate route.
  document.querySelector('.topbar').remove();document.querySelector('footer').remove();
  $('manager').remove();$('duplicate-dialog').remove();document.querySelector('.view-heading .eyebrow').remove();
  loadPublic();setInterval(()=>{if(!document.hidden&&!$('refresh').disabled)loadPublic();},900000);
}
