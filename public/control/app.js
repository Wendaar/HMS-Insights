import {organizations,organizationById,appsForOrganization,categories,linkLabels,filterApps} from './registry.js';
import {mapForOrganization,nodeUrl,validId,readContext,writeContext} from './map.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let orgId='',context={},view='map',zoom=1,category='all',gamesRequest=0,availableGames=[],catalogRequest=0,gameLists=new Map(),catalogMessage='';
const workBranches={broadcast:['broadcast','sponsors','gameshow'],social:['social','awards','sponsors','players'],games:['games','insights','players','competition'],data:['data','development']};
function anchor(href,label,cls){const a=el('a',label,cls);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function persist(){if(!writeContext(localStorage,orgId,context))$('organization-note').textContent='Kontext je aktivní, ale prohlížeč nepovolil jeho uložení.';}
function selectedLeague(){return (context.leagues??[]).find(l=>l.name===context.league);}
function activeContext(){return {...context,seasonId:selectedLeague()?.seasonId??'',gamesPath:selectedLeague()?.gamesPath??null};}
function showSettings(){
 $('context-title').textContent='Sezona a zápas · '+(organizationById(orgId)?.name??'');
 fillLeagueMenu($('context-league'));$('context-league').value=context.league??'';
 fillGameMenu($('context-game'),$('context-league').value,context.gameId??'');
 $('catalog-note').textContent=catalogMessage;$('context-error').textContent='';$('context-dialog').showModal();
 loadSeasonGames($('context-league').value);
}
function detail(node){$('detail-phase').textContent=node.status+' / '+(node.application?.dataSource??'Zatím není připojeno');$('detail-title').textContent=node.label;$('detail-note').textContent=[node.note,node.application?.description].filter(Boolean).join(' ');$('detail-links').replaceChildren();const url=nodeUrl(node,orgId,activeContext());if(url)$('detail-links').append(anchor(url,'Otevřít '+node.label+' ↗','primary'));else if(node.status!=='Planned'&&['games-view','game-report','obs-output'].includes(node.id)){const b=el('button',node.id==='games-view'?'Vybrat sezonu':'Vybrat zápas','primary');b.onclick=()=>{$('detail-dialog').close();showSettings();};$('detail-links').append(b);}for(const [key,url]of Object.entries(node.application?.links??{}))$('detail-links').append(anchor(url,linkLabels[key]??key,'secondary'));$('detail-dialog').showModal();}
function nodeCard(node){const card=el('article',null,'node '+node.status);card.dataset.node=node.id;const top=el('div',null,'node-top');top.append(el('span',node.kind==='manage'?'NASTAVENÍ':node.kind==='output'||node.kind==='export'?'VÝSTUP':'NÁSTROJ'),el('span',node.status,'badge '+node.status));const href=nodeUrl(node,orgId,activeContext());let action;if(href)action=anchor(href,node.label+' ↗','node-action');else{action=el('button',node.label,'node-action');action.onclick=()=>detail(node);}const bottom=el('div',null,'node-bottom'), info=el('button','Podrobnosti ⓘ','info');info.setAttribute('aria-label','Podrobnosti · '+node.label);info.onclick=()=>detail(node);bottom.append(el('small',node.id==='game-report'&&!context.gameId?'Vyberte zápas':node.id==='games-view'&&!activeContext().seasonId?'Vyberte ligu / sezonu':node.status==='Planned'?'Zatím nepropojeno':node.kind==='export'?'PNG export ve Studiu':node.kind==='output'?'Samostatná OBS stránka':node.application?.dataSource??''),info);card.append(top,action,bottom);return card;}
function matches(node){const app=node.application??{name:node.label,description:node.note??'',category:'',dataSource:''};return ($('status').value==='all'||node.status===$('status').value)&&filterApps([{...app,name:node.label+' '+app.name}],{query:$('search').value}).length;}
function drawConnections(){const svg=$('connections'),stage=$('map-stage');svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);const rect=stage.getBoundingClientRect(),box=n=>{const r=n.getBoundingClientRect();return{x:(r.left-rect.left)/zoom,y:(r.top-rect.top)/zoom,w:r.width/zoom,h:r.height/zoom};};const hub=box($('hub'));function path(d,cls){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p);}for(const row of $('branches').children){const nodes=[...row.querySelectorAll('.node')];if(!nodes.length)continue;const first=box(nodes[0]),x=hub.x+hub.w,y=hub.y+hub.h/2,tx=first.x,ty=first.y+first.h/2;path(`M ${x} ${y} C ${x+34} ${y}, ${x+34} ${ty}, ${tx-8} ${ty}`,'branch-line '+row.dataset.color);for(let i=1;i<nodes.length;i++){const a=box(nodes[i-1]),b=box(nodes[i]);path(`M ${a.x+a.w} ${a.y+a.h/2} L ${b.x-6} ${b.y+b.h/2}`,'step-line '+(nodes[i].classList.contains('Planned')?'planned':''));}}
const sponsor=$('branches').querySelector('[data-node="sponsor-definition"]');if(sponsor){const a=box(sponsor);for(const id of ['obs-studio','social-studio']){const target=$('branches').querySelector(`[data-node="${id}"]`);if(!target)continue;const b=box(target);path(`M ${a.x+a.w/2} ${a.y} C ${a.x+a.w/2} ${a.y-26}, ${b.x-15} ${a.y-26}, ${b.x-15} ${b.y+b.h/2} L ${b.x} ${b.y+b.h/2}`,'cross-line');}}
$('map-size').style.width=stage.offsetWidth*zoom+'px';$('map-size').style.height=stage.offsetHeight*zoom+'px';}
function renderMap(){const branches=mapForOrganization(orgId).filter(b=>!workBranches[context.work]||workBranches[context.work].includes(b.id));$('branches').replaceChildren();let count=0;for(const branch of branches){const matched=branch.nodes.filter(matches);if(!matched.length)continue;const row=el('section',null,'branch');row.dataset.color=branch.color;row.append(el('h3',branch.name,'branch-title'));const chain=el('div',null,'chain');for(const node of branch.nodes){const card=nodeCard(node);if(!matches(node))card.classList.add('dimmed');else count++;chain.append(card);}row.append(chain);$('branches').append(row);}$('result-count').textContent=count+' zobrazených nodů · '+(organizationById(orgId)?.name??'Neznámá organizace');$('empty').hidden=count!==0;requestAnimationFrame(drawConnections);}
function renderList(){$('categories').replaceChildren();for(const c of [{id:'all',name:'Vše'},...categories]){const b=el('button',c.name);b.setAttribute('aria-pressed',String(c.id===category));b.onclick=()=>{category=c.id;renderList();};$('categories').append(b);}const apps=filterApps(appsForOrganization(orgId),{query:$('search').value,category});$('applications').replaceChildren();for(const app of apps){const status=app.status==='available'?'Ready':app.status==='partial'?'Beta':'Planned';if($('status').value!=='all'&&status!==$('status').value)continue;const card=el('article',null,'list-card');card.append(el('span',status,'badge '+status),el('h3',app.name),el('p',app.description),el('small',app.dataSource));const links=el('div',null,'detail-links');for(const [kind,href]of Object.entries(app.links))links.append(anchor(href,linkLabels[kind]??kind,'secondary'));if(!links.children.length)links.append(el('span','Odkazy zatím nejsou nastavené.'));card.append(links);$('applications').append(card);}$('empty').hidden=$('applications').children.length!==0;if(view==='list')$('result-count').textContent=$('applications').children.length+' položek · '+(organizationById(orgId)?.name??'Neznámá organizace');}
function render(){renderMap();renderList();}
function setView(value){view=value;$('map-view').hidden=view!=='map';$('list-view').hidden=view!=='list';$('view-map').setAttribute('aria-pressed',String(view==='map'));$('view-list').setAttribute('aria-pressed',String(view==='list'));render();}
function usableLeagues(){return (context.leagues??[]).filter(l=>validId(l.seasonId));}
function fillLeagueMenu(menu){const value=menu.value;menu.replaceChildren(new Option(usableLeagues().length?'Vyberte soutěž a sezonu…':'Nabídka sezon zatím není načtená',''),...usableLeagues().map(l=>new Option(l.name,l.name)));menu.value=value;}
function gameLabel(){return context.gameLabel&&!validId(context.gameLabel)?context.gameLabel:'Dříve vybraný zápas';}
function fillGameMenu(menu,leagueName,value=''){
 const league=usableLeagues().find(l=>l.name===leagueName),rows=gameLists.get(league?.seasonId)??[];
 const choices=new Map(rows.map(g=>[g.gameId,g.label]));
 if(menu.id==='game')for(const g of availableGames)choices.set(g.gameId,g.label);
 if(validId(value)&&!choices.has(value))choices.set(value,gameLabel());
 menu.replaceChildren(new Option('Bez vybraného zápasu',''),...[...choices].map(([id,label])=>new Option(label,id)));menu.value=value;
}
function populateContext(){
 const org=organizationById(orgId);
 const sponsorNode=mapForOrganization(orgId).flatMap(b=>b.nodes).find(n=>n.id==='sponsor-definition');
 $('sponsor-source').replaceChildren(el('span','SPOLEČNÝ ZDROJ','eyebrow'));
 const sponsorUrl=sponsorNode&&nodeUrl(sponsorNode,orgId);if(sponsorUrl)$('sponsor-source').append(anchor(sponsorUrl,'Sponzoři z HMS ↗','source-link'));else $('sponsor-source').append(el('strong','Sponzoři · Planned'));
 $('sponsor-source').append(el('small','Jedna evidence pro Broadcast, Social a web. Propojení nástrojů postupně.'));
 fillLeagueMenu($('league'));$('league').value=context.league??'';
 fillGameMenu($('game'),context.league,context.gameId??'');$('work').value=context.work??'all';$('hub-org').textContent=org?.name??'Vyberte organizaci';
 $('organization-note').textContent=org?org.name+' · '+(context.league||'Sezona zatím nevybraná')+' · '+(context.gameId?gameLabel():'Bez zápasu')+' · '+(org.ready?'Vlastní organizační kontext':'Připojení nástrojů zatím není nastavené'):'Neznámá organizace. Vyberte jednu z nabídky.';
 $('settings').disabled=!org;$('load-games').disabled=!['phm','euchl'].includes(orgId);
}
async function loadSeasonGames(name){
 const league=usableLeagues().find(l=>l.name===name);if(!league||gameLists.has(league.seasonId))return;
 const selectedOrg=orgId,version=catalogRequest;
 try{
  const res=await fetch('/api/studio?'+new URLSearchParams({catalog:'games',org:orgId.toUpperCase(),seasonId:league.seasonId}),{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error();const data=await res.json();if(selectedOrg!==orgId||version!==catalogRequest)return;
  if(data.org!==orgId.toUpperCase()||data.seasonId!==league.seasonId||!Array.isArray(data.items))throw Error();
  gameLists.set(league.seasonId,data.items.filter(g=>validId(g.gameId)&&g.seasonId.toLowerCase()===league.seasonId.toLowerCase()));
  if(context.league===name)fillGameMenu($('game'),name,context.gameId??'');
  if($('context-league').value===name)fillGameMenu($('context-game'),name,$('context-game').value);
 }catch{if(version===catalogRequest&&selectedOrg===orgId){$('catalog-note').textContent='Zápasy této sezony se nepodařilo načíst. Zkuste obnovit nabídku.';}}
}
async function loadLeagueCatalog(){
 const selectedOrg=orgId,version=++catalogRequest;if(!selectedOrg)return;
 catalogMessage='Načítám názvy soutěží a sezon z HMS…';$('catalog-note').textContent=catalogMessage;
 try{
  const res=await fetch('/api/studio?'+new URLSearchParams({catalog:'leagues',org:orgId.toUpperCase()}),{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error();const data=await res.json();if(selectedOrg!==orgId||version!==catalogRequest)return;
  if(data.org!==orgId.toUpperCase()||!Array.isArray(data.items))throw Error();
  const incoming=data.items.filter(l=>validId(l.seasonId)&&typeof l.name==='string');
  const merged=new Map(usableLeagues().map(l=>[l.seasonId,l]));for(const l of incoming)merged.set(l.seasonId,l);
  context.leagues=[...merged.values()];
  if(!usableLeagues().some(l=>l.name===context.league))context.league='';
  catalogMessage=incoming.length?'Soutěže a sezony z načtených dat HMS. Stačí vybrat název.':'Pro tuto organizaci ještě nejsou načtené žádné sezony. Datové napojení musí doplnit správa HMS; žádné UID nepotřebujete.';
  persist();populateContext();render();fillLeagueMenu($('context-league'));$('context-league').value=context.league??'';$('catalog-note').textContent=catalogMessage;
  if(context.league)loadSeasonGames(context.league);
 }catch{
  if(selectedOrg!==orgId||version!==catalogRequest)return;
  catalogMessage='Nabídku sezon se nepodařilo načíst. Obnovte ji prosím; pokud je prázdná, je potřeba doplnit datové připojení organizace. Žádné UID zadávat nemusíte.';$('catalog-note').textContent=catalogMessage;$('organization-note').textContent=catalogMessage;
 }
}
function selectOrg(){gamesRequest++;catalogRequest++;availableGames=[];gameLists.clear();const requested=new URLSearchParams(location.search).get('org')??'phm';orgId=organizationById(requested)?.id??'';context=orgId?readContext(localStorage,orgId):{};$('organization').value=orgId;populateContext();render();loadLeagueCatalog();}
for(const org of organizations)$('organization').append(new Option(org.name+(org.ready?'':' · Planned'),org.id));
$('organization').onchange=()=>{const url=new URL(location.href);url.searchParams.set('org',$('organization').value);history.pushState(null,'',url);selectOrg();};addEventListener('popstate',selectOrg);
$('settings').onclick=showSettings;$('league').onchange=()=>{gamesRequest++;context.league=$('league').value;availableGames=[];context.gameId='';context.gameLabel='';persist();populateContext();render();loadSeasonGames(context.league);};$('game').onchange=()=>{context.gameId=$('game').value;context.gameLabel=context.gameId?$('game').selectedOptions[0].textContent:'';persist();populateContext();render();};$('work').onchange=()=>{context.work=$('work').value;persist();render();};
$('context-form').onsubmit=e=>{e.preventDefault();gamesRequest++;availableGames=[];context.league=$('context-league').value;context.gameId=$('context-game').value;context.gameLabel=context.gameId?$('context-game').selectedOptions[0].textContent:'';persist();$('context-dialog').close();populateContext();render();};
$('context-league').onchange=()=>{fillGameMenu($('context-game'),$('context-league').value);loadSeasonGames($('context-league').value);};
$('refresh-catalog').onclick=()=>{gameLists.clear();loadLeagueCatalog();};
$('clear-context').onclick=()=>{context={};persist();$('context-dialog').close();populateContext();render();loadLeagueCatalog();};
$('load-games').onclick=async()=>{
 const requestedOrg=orgId,seasonId=activeContext().seasonId,version=++gamesRequest;$('organization-note').textContent='Načítám dnešní zápasy z HMS…';
 try{
  const path=validId(seasonId)?'/api/game-summary?'+new URLSearchParams({view:'games',seasonId,filter:'Today'}):'/api/broadcast?'+new URLSearchParams({org:orgId.toUpperCase(),filter:'Today'});
  const res=await fetch(path,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error();const data=await res.json();
  if(version!==gamesRequest||requestedOrg!==orgId||seasonId!==activeContext().seasonId)return;
  if(!Array.isArray(data.items)||(validId(seasonId)?data.seasonId!==seasonId.toLowerCase():data.org!==orgId.toUpperCase()))throw Error();
  availableGames=data.items.filter(g=>validId(g.gameId??g.id)).map(g=>({gameId:g.gameId??g.id,label:(g.home?.name??'Domácí')+' — '+(g.away?.name??'Hosté')+' · '+(g.startTime??g.time??'')}));
  populateContext();$('organization-note').textContent=data.items.length?data.items.length+' dnešních zápasů · '+(context.league||requestedOrg.toUpperCase())+' · vyberte zápas nahoře.':'HMS dnes nevrátilo žádné zápasy. Starší zápas vyberte podle názvu v nabídce sezony.';
 }catch{if(version===gamesRequest&&requestedOrg===orgId)$('organization-note').textContent='Zápasy se nepodařilo načíst. Zkuste načtení znovu nebo vyberte načtený zápas své sezony.';}
};
$('view-map').onclick=()=>setView('map');$('view-list').onclick=()=>setView('list');$('search').oninput=render;$('status').onchange=render;$('reset').onclick=()=>{$('search').value='';$('status').value='all';context.work='all';category='all';populateContext();render();};
function setZoom(value){zoom=Math.max(.45,Math.min(1.4,value));$('map-stage').style.transform=`scale(${zoom})`;$('zoom-label').textContent=Math.round(zoom*100)+' %';requestAnimationFrame(drawConnections);}
$('zoom-in').onclick=()=>setZoom(zoom+.1);$('zoom-out').onclick=()=>setZoom(zoom-.1);$('fit').onclick=()=>{setZoom(($('viewport').clientWidth-20)/$('map-stage').offsetWidth);$('viewport').scrollTo(0,0);};
$('help').onclick=()=>{$('detail-title').textContent='Jak se v mapě orientovat';$('detail-phase').textContent='HMS → NASTAVENÍ → OVLÁDÁNÍ → VÝSTUP';$('detail-note').textContent='Vyberte organizaci, ligu a případně zápas. Kliknutím na velký název nodu otevřete nástroj. Podrobnosti ukazují zdroje, GitHub a omezení. Větve jsou pracovní postupy, Sponsors má navíc přerušované vazby do Broadcast a Social Studia. Ostatní vztahy mezi hráčskými nástroji nejsou výrobní postup. Mapu posouvejte tažením pozadí nebo pomocí posuvníků; tlačítko Celá mapa ji oddálí. Všechny původní odkazy najdete v druhém pohledu.';$('detail-links').replaceChildren();$('detail-dialog').showModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
let drag=null;$('viewport').onpointerdown=e=>{if(e.target.closest('button,a,input,select,.node'))return;drag={x:e.clientX,y:e.clientY,left:$('viewport').scrollLeft,top:$('viewport').scrollTop};$('viewport').setPointerCapture(e.pointerId);};$('viewport').onpointermove=e=>{if(drag){$('viewport').scrollLeft=drag.left-(e.clientX-drag.x);$('viewport').scrollTop=drag.top-(e.clientY-drag.y);}};$('viewport').onpointerup=$('viewport').onpointercancel=()=>drag=null;$('viewport').addEventListener('scroll',()=>requestAnimationFrame(drawConnections));addEventListener('resize',()=>requestAnimationFrame(drawConnections));
selectOrg();
