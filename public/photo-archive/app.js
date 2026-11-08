import {initialSelection,thumbnailState} from './review-model.js';
const $=id=>document.getElementById(id),org=new URLSearchParams(location.search).get('org') || 'phm';
let catalog=[],current=null,selectedId=null,chosen=new Set(),archive=[],busy=false,caseRequest=0;
let analyzing=false,stopAnalysis=false;
const folded=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
const teamName=id=>current?.state?.teams.find(t=>same(t.teamId,id))?.name || 'Tým';
const photo=()=>current?.state?.photos.find(p=>p.id===selectedId);
const status=p=>current?.state?.reviews[p.id]?.status || 'pending';
const statusLabels={pending:'K ověření',in_progress:'Rozpracováno',confirmed:'Uzavřeno · schváleno',rejected:'Uzavřeno · bez přiřazení'};
const colors={white:'bílá',black:'černá',grey:'šedá',red:'červená',blue:'modrá',green:'zelená',yellow:'žlutá',orange:'oranžová',purple:'fialová',unknown:'neurčeno'};
const roleLabel=role=>role==='goalie'?'Brankář':role==='skater'?'Hráč v poli':'Role neurčena';
const message=(value,error=false)=>{$('notice').textContent=value;$('notice').className=error?'error':'success';};
function setBusy(value){busy=value;$('import').disabled=value;$('game-select').disabled=value;$('logout').disabled=value;$('ai-start').disabled=value || !current?.state;$('ai-refresh').disabled=value;$('ai-limit').disabled=value;$('ai-retry').disabled=value;$('ai-upgrade').disabled=value;updateActions();}
async function api(action,{body,bearer,query={}}={}){
  const response=await fetch('/api/photo-archive?'+new URLSearchParams({org,action,...query}),{method:body || action==='session' || action==='logout'?'POST':'GET',credentials:'same-origin',
    headers:{...(body?{'content-type':'application/json'}:{}),...(bearer?{authorization:'Bearer '+bearer}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(55000)});
  const data=await response.json();
  if(!response.ok){if(response.status===401){$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;}throw Error(data.error || 'Požadavek se nezdařil.');}return data;
}
async function task(fn){if(busy)return;setBusy(true);try{await fn();}catch(error){message(error.message,true);}finally{setBusy(false);}}
function setTab(tab){
  $('review-tab').setAttribute('aria-pressed',String(tab==='review'));$('archive-tab').setAttribute('aria-pressed',String(tab==='archive'));
  $('review-panel').hidden=tab!=='review';$('archive-panel').hidden=tab!=='archive';
}
async function loadCatalog(){
  const data=await api('catalog');catalog=data.cases;
  const previous=$('game-select').value;
  $('game-select').replaceChildren(...catalog.map(c=>new Option(c.title,c.gameId)));
  if(catalog.some(c=>c.gameId===previous))$('game-select').value=previous;
}
async function loadCase(gameId=$('game-select').value,targetPhoto=null){
  if(!gameId)return;const generation=++caseRequest;
  const data=await api('case',{query:{gameId}});if(generation!==caseRequest)return;
  current=data;selectedId=targetPhoto || data.state?.photos.find(p=>p.suggestions.some(s=>s.candidates.length))?.id || null;chosen.clear();$('player-search').value='';$('note').value='';$('verified').checked=false;
  renderCase();message(data.needsImport?'Vyberte Načíst album pro první import.':'Načteno z uloženého fotoarchivu.');
}
function renderCase(){
  renderAnalysis();
  $('jersey-context').replaceChildren();
  $('needs-import').hidden=!current?.needsImport;$('review-layout').hidden=!current?.state;
  $('stats').replaceChildren();
  if(!current?.state){$('game-meta').textContent='';$('photo-detail').hidden=true;return;}
  const state=current.state;$('game-meta').textContent=`${state.title} · ${state.playedOn?new Date(state.playedOn).toLocaleDateString('cs-CZ'):''} · ${state.players.length} hráčů · ${state.albumTotal} fotografií v albu · Revize ${current.revision}`;
  for(const team of state.teams){const chip=text('span',`${team.name}: ${colors[team.jerseyFamily] || 'dres není načten'}${team.jerseySource==='hms-game'?' · HMS zápas':''}`,'jersey-chip');if(/^#[a-f0-9]{6}$/i.test(team.jerseyColor || '')){const dot=text('i','','jersey-dot');dot.style.backgroundColor=team.jerseyColor;chip.prepend(dot);}$('jersey-context').append(chip);}
  for(const [key,label] of [['total','fotografií'],['pending','k ověření'],['inProgress','rozpracovaných'],['confirmed','uzavřených s hráči'],['rejected','bez přiřazení']]){const node=text('span','');node.append(text('strong',current.stats[key] || 0),document.createTextNode(label));$('stats').append(node);}
  const oldTeam=$('player-team').value;$('player-team').replaceChildren(new Option('Oba týmy',''),...state.teams.map(t=>new Option(t.name,t.teamId)));$('player-team').value=oldTeam;
  renderGrid();
}
function filteredPhotos(){const filter=$('status-filter').value;return (current?.state?.photos || []).filter(p=>filter==='all' || filter==='ai' && p.suggestions.some(s=>s.candidates.length) || status(p)===filter);}
function renderGrid(){
  const photos=filteredPhotos(),grid=$('photo-grid');grid.replaceChildren();$('photo-count').textContent=String(photos.length);$('no-photos').hidden=photos.length>0;
  if(!photos.some(p=>p.id===selectedId))selectedId=photos[0]?.id || null;
  for(const p of photos){
    const button=text('button','', 'photo-tile');button.type='button';button.dataset.status=status(p);button.setAttribute('aria-pressed',String(p.id===selectedId));button.setAttribute('aria-label',`Fotografie ${p.id}, ${statusLabels[status(p)]}`);
    if(p.thumbnailUrl || p.previewUrl){const image=document.createElement('img');image.src=p.thumbnailUrl || p.previewUrl;image.alt=p.title || 'Fotografie zápasu';image.loading='lazy';button.append(image);}
    button.append(text('span',thumbnailState(p,current.state.reviews[p.id])));button.title=(current.state.reviews[p.id]?.players || []).map(p=>p.name).join(', ');
    button.onclick=()=>{if(busy)return;selectedId=p.id;renderGrid();};grid.append(button);
  }
  selectPhoto();
}
function selectPhoto(){
  const p=photo();$('photo-detail').hidden=!p;if(!p)return;
  const review=current.state.reviews[p.id];chosen=new Set(initialSelection(p,review));$('verified').checked=false;$('note').value=review?.note || '';$('player-search').value='';
  $('manual-panel').hidden=review?.status!=='in_progress' && p.suggestions.some(s=>s.candidates.length);$('player-role').value='';$('player-team').value='';
  $('photo-title').textContent=p.title || 'Fotografie '+p.id;$('review-status').textContent=statusLabels[status(p)];
  $('large-photo').src=p.previewUrl || p.thumbnailUrl || '';$('large-photo').alt=p.title || current.state.title;$('original-link').href=p.originalUrl;
  const evidence=$('ai-evidence');evidence.replaceChildren();
  evidence.append(text('h3','AI návrhy hráčů'));
  if(!p.observations.length)evidence.append(text('p',p.analysis?.status==='complete'?'AI kontrola dokončena. Na této fotce nenašla čitelné číslo pro návrh hráče.':p.analysis?.status==='failed'?'AI kontrola této fotky selhala. Podrobnosti jsou v průběhu alba.':p.analysis?.status==='processing'?'AI právě zpracovává tuto fotku…':'Tato fotka ještě neprošla AI kontrolou. Spusťte ji nad albem nahoře, nebo přiřaďte hráče ručně.'));
  p.observations.forEach((o,i)=>{
    const suggestion=p.suggestions[i],card=text('div','','observation-card');
    card.append(text('strong',`Osoba ${i+1} · #${o.observedNumber || '?'} · ${colors[o.jerseyColor] || 'barva neurčena'} · ${roleLabel(o.role)}`));
    card.append(text('p',`Jistota čtení čísla ${Math.round(o.confidence*100)} %${suggestion?.teamId?' · tým podle dresu HMS: '+teamName(suggestion.teamId):' · tým není rozlišen'}${suggestion?.tentative?' · nejistý návrh, vyberte ručně':''}`,'muted'));
    if(o.evidence)card.append(text('p',o.evidence,'muted'));
    if(suggestion?.candidates.length){
      if(suggestion.candidates.length>1)card.append(text('p','Tým nebo osoba nejsou jednoznačné. Vyberte odpovídajícího hráče:','muted'));
      for(const candidate of suggestion.candidates){
        const label=text('label','','proposal-option'),check=document.createElement('input');check.type='checkbox';check.dataset.playerId=candidate.playerId;check.checked=chosen.has(candidate.playerId);
        check.onchange=()=>{if(check.checked)chosen.add(candidate.playerId);else chosen.delete(candidate.playerId);renderPlayers();};
        label.append(check,text('span',`${candidate.name} · #${candidate.jerseyNumber ?? '?'} · ${teamName(candidate.teamId)}${candidate.role==='goalie'?' · BRANKÁŘ':''}`));card.append(label);
      }
    }else card.append(text('p','Bez návrhu hráče. Můžete doplnit osobu ze soupisky.','muted'));
    evidence.append(card);
  });
  if(p.analysis?.status==='complete' && p.analysis.analysisVersion!==2)evidence.append(text('p','Starší AI čtení neobsahuje spolehlivé barvy a role. Tlačítkem níže je můžete doplnit novou analýzou.','legacy-warning'));
  $('last-review').textContent=review?`${review.reviewerLabel} · ${new Date(review.reviewedAt).toLocaleString('cs-CZ')} · ${statusLabels[review.status]}`:'Zatím bez ručního rozhodnutí.';
  renderPlayers();
}
const analysisErrors={quota:'OpenAI nemá dostupný kredit nebo kvótu.',credentials:'OpenAI odmítlo klíč nebo oprávnění.',rate_limit:'OpenAI omezilo počet požadavků.',timeout:'Vypršel čas odpovědi; pokus mohl být účtovaný.',interrupted:'Předchozí požadavek byl přerušen; mohl být účtovaný.',analysis_failed:'Analýza se nezdařila. Pokus mohl být účtovaný.'};
function renderAnalysis(){
  const s=current?.analysisStats || {total:0,complete:0,remaining:0,failed:0},job=current?.state?.analysisJob;
  $('ai-progress').max=s.total || 1;$('ai-progress').value=s.complete;
  const usage=Object.values(current?.state?.analyses || {}).reduce((sum,a)=>sum+(a.usage?.totalTokens || 0),0);
  const error=job?.lastError || Object.values(current?.state?.analyses || {}).find(a=>a.status==='failed')?.error;
  $('ai-status').textContent=`AI hotovo ${s.complete}/${s.total} · čeká ${s.remaining} · starších bez barev/rolí ${s.outdated || 0} · chyb ${s.failed}${s.processing?' · právě zpracovává 1 fotku':''}${usage?' · evidováno '+usage+' tokenů':''}${error?' · '+(analysisErrors[error] || analysisErrors.analysis_failed):''}`;
  $('ai-start').textContent=s.complete?'Pokračovat v AI kontrole':'Spustit AI kontrolu';$('ai-start').disabled=busy || !current?.state;
}
async function analyzeAlbum(photoId=null){
  analyzing=true;stopAnalysis=false;$('ai-stop').hidden=false;$('ai-stop').disabled=false;
  try{
    current=await api('analyze-start',{body:{gameId:current.gameId,revision:current.revision,limit:photoId?1:Number($('ai-limit').value),retryFailed:$('ai-retry').checked,upgradeOld:!!photoId || $('ai-upgrade').checked,...(photoId?{photoId}:{})}});renderCase();
    while(current.state.analysisJob.status==='running' && !stopAnalysis){
      message('AI zpracovává další fotografii. Návrhy se průběžně ukládají…');
      current=await api('analyze-next',{body:{gameId:current.gameId,revision:current.revision,jobId:current.state.analysisJob.id}});renderCase();
    }
    if(current.state.analysisJob.status==='failed')message('AI kontrola se zastavila: '+(analysisErrors[current.state.analysisJob.lastError] || analysisErrors.analysis_failed)+' Hotové výsledky zůstávají uložené.',true);
    else message(stopAnalysis && current.state.analysisJob.status!=='completed'?'Pozastaveno. Uložené výsledky zůstávají; tlačítkem Pokračovat zpracujete zbytek.':'AI kontrola dokončena. Zvolte filtr AI navrhuje hráče a ověřte nabídnutá jména.');
  }finally{analyzing=false;$('ai-stop').hidden=true;}
}
function renderPlayers(){
  if(!current?.state)return;
  const players=current.state.players,needle=folded($('player-search').value),selected=$('selected-players');selected.replaceChildren();
  for(const id of chosen){const p=players.find(p=>same(p.playerId,id));if(!p)continue;const chip=text('button',`${p.name || 'Hráč'} · #${p.jerseyNumber ?? '?'} ×`,'player-chip');chip.type='button';chip.onclick=()=>{chosen.delete(id);renderPlayers();};selected.append(chip);}
  const matches=players.filter(p=>folded([p.name,p.jerseyNumber,teamName(p.teamId)].join(' ')).includes(needle) && (!$('player-team').value || same(p.teamId,$('player-team').value)) && (!$('player-role').value || ($('player-role').value==='goalie'?p.role==='goalie':p.role!=='goalie')));
  const sorted=[...matches].sort((a,b)=>teamName(a.teamId).localeCompare(teamName(b.teamId),'cs') || Number(a.jerseyNumber)-Number(b.jerseyNumber) || (a.name || '').localeCompare(b.name || '','cs'));
  const results=$('player-results');results.replaceChildren();
  for(const p of sorted){
    const label=document.createElement('label');label.className='player-option';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=chosen.has(p.playerId);
    checkbox.onchange=()=>{if(checkbox.checked)chosen.add(p.playerId);else chosen.delete(p.playerId);renderPlayers();};
    const description=text('span',p.name || 'Hráč');description.append(text('small',`#${p.jerseyNumber ?? '?'} · ${teamName(p.teamId)}${p.role==='goalie'?' · BRANKÁŘ':''}`));label.append(checkbox,description);results.append(label);
  }
  $('search-count').textContent=matches.length?`Zobrazeno všech ${matches.length} odpovídajících hráčů z ${players.length} v soupisce.`:'Žádný hráč v soupisce neodpovídá hledání.';
  for(const check of $('ai-evidence').querySelectorAll('input[data-player-id]'))check.checked=chosen.has(check.dataset.playerId);
  $('selected-count').textContent=`${chosen.size} vybraných`;$('verified').checked=false;updateActions();
}
function updateActions(){
  const p=photo();$('assign').disabled=busy || !p || !chosen.size || !$('verified').checked || !$('reviewer').value.trim();
  $('confirm-proposals').disabled=busy || !p || !chosen.size || !$('reviewer').value.trim();$('confirm-proposals').textContent=`Potvrdit výběr (${chosen.size}) a uzavřít`;
  $('proposal-summary').textContent=p?`${p.analysis?.status==='complete'?'AI kontrola provedena':'AI kontrola zatím není dokončená'} · Vybrané osoby: ${chosen.size} · AI pozorování: ${p.observations.length}. Potvrzení uzavře kontrolu této fotky; další osoby můžete nejdříve doplnit.`:'';
  for(const check of document.querySelectorAll('#ai-evidence input, #player-results input'))check.disabled=busy;
  for(const id of ['supplement-proposals','manual-proposals','save-draft'])$(id).disabled=busy || !p || !$('reviewer').value.trim();
  $('ai-photo').disabled=busy || !p || p.analysis?.status==='complete' && p.analysis.analysisVersion===2;
  $('reject').disabled=busy || !p || !$('reviewer').value.trim();$('reset').disabled=busy || !p;$('reset').hidden=!p || status(p)==='pending';
}
async function decide(decision){
  const id=selectedId;
  current=await api('decide',{body:{gameId:current.gameId,photoId:id,revision:current.revision,decision,playerIds:[...chosen],reviewer:$('reviewer').value.trim(),note:$('note').value}});
  renderCase();await loadCatalog();message(decision==='assign'?'Kontrola uzavřena. Schválené osoby a fotografie jsou uložené v archivu.':decision==='draft'?'Výběr uložen jako rozpracovaný. Doplňte osoby a pak kontrolu uzavřete.':decision==='reject'?'Kontrola uzavřena bez přiřazení.':'Fotografie byla vrácena ke kontrole.');
}
async function loadArchive(){const data=await api('archive');archive=data.players;renderArchive();}
function renderArchive(){
  const needle=folded($('archive-search').value),list=$('archive-list');list.replaceChildren();
  const players=archive.filter(p=>folded(p.name+' '+p.photos.map(p=>p.teamName).join(' ')).includes(needle));
  if(!players.length){list.append(text('div',archive.length?'Hledání neodpovídá žádný hráč.':'Zatím nejsou potvrzené žádné fotografie. Vyberte hráče v Kontrole shod a potvrďte přiřazení.','empty'));return;}
  for(const p of players){
    const details=document.createElement('details');details.className='archive-player';const summary=text('summary',p.name);const games=new Set(p.photos.map(p=>p.gameId)).size;summary.append(text('span',`${p.photos.length} ${p.photos.length<5?'fotografie':'fotografií'} · ${games} ${games===1?'zápas':games<5?'zápasy':'zápasů'}`));details.append(summary);
    const grid=document.createElement('div');grid.className='archive-photos';
    for(const photo of p.photos){const card=document.createElement('article');card.className='archive-photo';
      if(photo.previewUrl || photo.thumbnailUrl){const image=document.createElement('img');image.src=photo.previewUrl || photo.thumbnailUrl;image.alt=`${p.name} · ${photo.gameTitle}`;image.loading='lazy';card.append(image);}
      card.append(text('p',photo.gameTitle),text('p',`#${photo.jerseyNumber ?? '?'} · ${photo.teamName}`,'muted'));
      const links=document.createElement('div'),link=text('a','Flickr ↗');link.href=photo.originalUrl;link.target='_blank';link.rel='noopener noreferrer';
      const edit=text('button','Upravit přiřazení');edit.onclick=()=>task(async()=>{setTab('review');$('game-select').value=photo.gameId;$('status-filter').value='all';await loadCase(photo.gameId,photo.id);});links.append(link,edit);card.append(links);grid.append(card);
    }
    details.append(grid);list.append(details);
  }
}
async function initialize(){
  const access=await api('access');$('login').hidden=access.authorized;$('workspace').hidden=!access.authorized;$('logout').hidden=!access.authorized;
  if(!access.configured){message('Kód Operations pro PHM zatím není nastavený.',true);return;}
  if(!access.authorized){message('Přihlaste se kódem Operations pro PHM.');return;}
  await loadCatalog();const params=new URLSearchParams(location.search),requestedGame=params.get('gameId'),requestedPhoto=params.get('photoId');
  if(catalog.some(c=>same(c.gameId,requestedGame)))$('game-select').value=catalog.find(c=>same(c.gameId,requestedGame)).gameId;
  if(requestedPhoto)$('status-filter').value='all';
  await loadCase($('game-select').value,requestedPhoto);if(!access.storageReady)message('Databáze není připojená. Ukládání zatím není dostupné.',true);
}
$('login-form').onsubmit=event=>{event.preventDefault();task(async()=>{const code=$('access-code').value;try{await api('session',{bearer:code});}finally{$('access-code').value='';}await initialize();});};
$('logout').onclick=()=>task(async()=>{await api('logout');current=null;archive=[];chosen.clear();await initialize();});
$('game-select').onchange=()=>task(()=>loadCase());$('status-filter').onchange=renderGrid;
$('import').onclick=()=>task(async()=>{message('Načítám album z Flickru a ověřené soupisky z HMS…');current=await api('import',{body:{gameId:$('game-select').value,revision:current?.revision ?? 0}});renderCase();await loadCatalog();message('Album a soupisky jsou uložené. Můžete přiřazovat hráče.');});
$('status-filter').append(new Option('AI navrhuje hráče','ai'));
$('ai-start').onclick=()=>task(()=>analyzeAlbum());$('ai-stop').onclick=()=>{stopAnalysis=true;$('ai-stop').disabled=true;message('Dokončím a uložím právě zpracovávanou fotografii, poté pozastavím.');};
$('ai-photo').onclick=()=>task(()=>analyzeAlbum(selectedId));
$('confirm-proposals').onclick=()=>task(()=>decide('assign'));
async function openManual(clear){if(clear)chosen.clear();await decide('draft');$('manual-panel').hidden=false;$('manual-panel').scrollIntoView({behavior:'smooth',block:'start'});}
$('supplement-proposals').onclick=()=>task(()=>openManual(false));$('manual-proposals').onclick=()=>task(()=>openManual(true));$('save-draft').onclick=()=>task(()=>decide('draft'));
$('ai-refresh').onclick=()=>task(()=>loadCase(current?.gameId,selectedId));
$('player-search').oninput=renderPlayers;$('archive-search').oninput=renderArchive;$('verified').onchange=updateActions;$('reviewer').oninput=updateActions;
$('player-team').onchange=renderPlayers;$('player-role').onchange=renderPlayers;
$('assign').onclick=()=>task(()=>decide('assign'));$('reject').onclick=()=>task(()=>decide('reject'));$('reset').onclick=()=>task(()=>decide('reset'));
$('review-tab').onclick=()=>setTab('review');$('archive-tab').onclick=()=>task(async()=>{setTab('archive');await loadArchive();message('Archiv obsahuje pouze ručně potvrzená přiřazení.');});
function openZoom(){const p=photo();if(!p)return;$('zoom-image').src=p.previewUrl || p.thumbnailUrl;$('zoom-image').style.width='100%';$('zoom-range').value='1';$('zoom-dialog').showModal();}
$('zoom-open').onclick=openZoom;$('zoom-button').onclick=openZoom;$('zoom-close').onclick=()=>$('zoom-dialog').close();$('zoom-range').oninput=()=>{$('zoom-image').style.width=Number($('zoom-range').value)*100+'%';};
task(initialize);
