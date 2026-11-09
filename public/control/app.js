import {sameSiteUrl} from '../public-output.js';
import {loadOrganizationCatalog} from '../organization-catalog.js';
import {setOrganizationCatalog,organizations,organizationById,appsForOrganization,categories,linkLabels,filterApps} from './registry.js';
import {mapForOrganization,nodeUrl,validId,readContext,writeContext,workBranches} from './map.js';
import {workChats,workChatFor,workChatHref} from './work-chats.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const currentOrgCode=()=>organizationById(orgId)?.code??'';
let orgId='',context={},view='map',zoom=1,category='all',catalogRequest=0,catalogMessage='';
function anchor(href,label,cls){const a=el('a',label,cls);a.href=sameSiteUrl(href);a.target='_blank';a.rel='noopener noreferrer';return a;}
function chatPanel(chat,compact=false){
 const box=el('div',null,'work-chat'+(compact?' compact':'')),href=workChatHref(chat);
 if(!href){box.append(el('span','Pracovní chat zatím nepřiřazen','work-chat-missing'));return box;}
 const link=anchor(href,'Řešit v chatu ↗','work-chat-link');
 link.title=chat.title+(chat.kind==='codex'?' · Otevře aplikaci ChatGPT / Codex':' · Otevře ChatGPT');
 link.setAttribute('aria-label','Řešit v chatu: '+chat.title);
 box.append(link,el('span',chat.title,'work-chat-title'));
 if(!compact){box.append(el('p',chat.topic));const copy=el('button','Kopírovat název','secondary');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(chat.title);copy.textContent='Název zkopírován';}catch{copy.textContent='Označte a zkopírujte název výše';}};box.append(copy);}
 return box;
}
function showWorkChats(){const list=$('work-chat-list');list.replaceChildren(...Object.values(workChats).map(chat=>chatPanel(chat)));$('work-chats-dialog').showModal();}
function persist(){if(!writeContext(localStorage,orgId,context))$('organization-note').textContent='Kontext je aktivní, ale prohlížeč nepovolil jeho uložení.';}
function selectedLeague(){return (context.leagues??[]).find(l=>l.name===context.league);}
function activeContext(){return {...context,gameId:'',gameLabel:'',seasonId:selectedLeague()?.seasonId??'',gamesPath:selectedLeague()?.gamesPath??null};}
function showSettings(){
 $('context-title').textContent='Soutěž a sezona · '+(organizationById(orgId)?.name??'');
 fillLeagueMenu($('context-league'));$('context-league').value=context.league??'';
 $('catalog-note').textContent=catalogMessage;$('context-error').textContent='';$('context-dialog').showModal();
}
function detail(node){$('detail-phase').textContent=node.status+' / '+(node.application?.dataSource??'Zatím není připojeno');$('detail-title').textContent=node.label;$('detail-note').textContent=[node.note,node.application?.description].filter(Boolean).join(' ');$('detail-links').replaceChildren(chatPanel(workChatFor(node.application?.id,node.id)));const url=nodeUrl(node,orgId,activeContext());if(url)$('detail-links').append(anchor(url,'Otevřít '+node.label+' ↗','primary'));else if(node.status!=='Planned'&&['games-view','game-report','obs-output'].includes(node.id)){const b=el('button',node.id==='games-view'?'Vybrat sezonu':'Vybrat zápas','primary');b.onclick=()=>{$('detail-dialog').close();showSettings();};$('detail-links').append(b);}for(const [key,url]of Object.entries(node.application?.links??{}))$('detail-links').append(anchor(url,linkLabels[key]??key,'secondary'));$('detail-dialog').showModal();}
function nodeCard(node){const card=el('article',null,'node '+node.status);card.dataset.node=node.id;const top=el('div',null,'node-top');top.append(el('span',node.kind==='manage'?'NASTAVENÍ':node.kind==='output'||node.kind==='export'?'VÝSTUP':'NÁSTROJ'),el('span',node.status,'badge '+node.status));const href=nodeUrl(node,orgId,activeContext());let action;if(href)action=anchor(href,node.label+' ↗','node-action');else{action=el('button',node.label,'node-action');action.onclick=()=>detail(node);}const bottom=el('div',null,'node-bottom'), info=el('button','Podrobnosti ⓘ','info');info.setAttribute('aria-label','Podrobnosti · '+node.label);info.onclick=()=>detail(node);bottom.append(el('small',node.id==='game-report'&&!context.gameId?'Vyberte zápas':node.id==='games-view'&&!activeContext().seasonId?'Vyberte ligu / sezonu':node.status==='Planned'?'Zatím nepropojeno':node.kind==='export'?'PNG export ve Studiu':node.kind==='output'?'Samostatná OBS stránka':node.application?.dataSource??''),info);card.append(top,action);if(node.id==='social-studio'||node.id==='photo-archive')card.append(el('p',node.note||node.application?.description,'node-description'));const shortcuts=el('div',null,'node-shortcuts');for(const [key,label]of [['archive','Archiv ↗']])if(node.application?.links[key])shortcuts.append(anchor(node.application.links[key],label));card.append(shortcuts,bottom,chatPanel(workChatFor(node.application?.id,node.id),true));return card;}
function matches(node){const app=node.application??{name:node.label,description:node.note??'',category:'',dataSource:''};return ($('status').value==='all'||node.status===$('status').value)&&filterApps([{...app,name:node.label+' '+app.name}],{query:$('search').value}).length;}
function drawConnections(){const svg=$('connections'),stage=$('map-stage');svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);const rect=stage.getBoundingClientRect(),box=n=>{const r=n.getBoundingClientRect();return{x:(r.left-rect.left)/zoom,y:(r.top-rect.top)/zoom,w:r.width/zoom,h:r.height/zoom};};const hub=box($('hub'));function path(d,cls){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p);}for(const row of $('branches').children){const nodes=[...row.querySelectorAll('.node')];if(!nodes.length)continue;const first=box(nodes[0]),x=hub.x+hub.w,y=hub.y+hub.h/2,tx=first.x,ty=first.y+first.h/2;path(`M ${x} ${y} C ${x+34} ${y}, ${x+34} ${ty}, ${tx-8} ${ty}`,'branch-line '+row.dataset.color);for(let i=1;i<nodes.length;i++){const a=box(nodes[i-1]),b=box(nodes[i]);if(Math.abs(a.y-b.y)>5)continue;path(`M ${a.x+a.w} ${a.y+a.h/2} L ${b.x-6} ${b.y+b.h/2}`,'step-line '+(nodes[i].classList.contains('Planned')?'planned':''));}}
$('map-size').style.width=stage.offsetWidth*zoom+'px';$('map-size').style.height=stage.offsetHeight*zoom+'px';}
function renderMap(){const branches=mapForOrganization(orgId).filter(b=>!workBranches[context.work]||workBranches[context.work].includes(b.id));$('branches').replaceChildren();let count=0;for(const branch of branches){const matched=branch.nodes.filter(matches);if(!matched.length)continue;const row=el('section',null,'branch');row.dataset.color=branch.color;row.append(el('h3',branch.name,'branch-title'));const chain=el('div',null,'chain');for(const node of branch.nodes){const card=nodeCard(node);if(!matches(node))card.classList.add('dimmed');else count++;chain.append(card);}row.append(chain);$('branches').append(row);}$('result-count').textContent=count+' zobrazených nodů · '+(organizationById(orgId)?.name??'Neznámá organizace');$('empty').hidden=count!==0;requestAnimationFrame(drawConnections);}
function renderList(){$('categories').replaceChildren();for(const c of [{id:'all',name:'Vše'},...categories]){const b=el('button',c.name);b.setAttribute('aria-pressed',String(c.id===category));b.onclick=()=>{category=c.id;renderList();};$('categories').append(b);}const roleApps=new Set(mapForOrganization(orgId).filter(b=>!workBranches[context.work]||workBranches[context.work].includes(b.id)).flatMap(b=>b.nodes.map(n=>n.app)));const apps=filterApps(appsForOrganization(orgId).filter(app=>!workBranches[context.work]||roleApps.has(app.id)||context.work==='data'&&['data','development'].includes(app.category)),{query:$('search').value,category});$('applications').replaceChildren();for(const app of apps){const status=app.status==='available'?'Ready':app.status==='partial'?'Beta':'Planned';if($('status').value!=='all'&&status!==$('status').value)continue;const card=el('article',null,'list-card');card.append(el('span',status,'badge '+status),el('h3',app.name),el('p',app.description),el('small',app.dataSource));const links=el('div',null,'detail-links');for(const [kind,href]of Object.entries(app.links))links.append(anchor(href,linkLabels[kind]??kind,'secondary'));if(!links.children.length)links.append(el('span','Odkazy zatím nejsou nastavené.'));card.append(links,chatPanel(workChatFor(app.id)));$('applications').append(card);}$('empty').hidden=$('applications').children.length!==0;if(view==='list')$('result-count').textContent=$('applications').children.length+' položek · '+(organizationById(orgId)?.name??'Neznámá organizace');}
function render(){renderMap();renderList();}
function setView(value){view=value;$('map-view').hidden=view!=='map';$('list-view').hidden=view!=='list';$('view-map').setAttribute('aria-pressed',String(view==='map'));$('view-list').setAttribute('aria-pressed',String(view==='list'));render();}
function usableLeagues(){return (context.leagues??[]).filter(l=>validId(l.seasonId));}
function fillLeagueMenu(menu){const value=menu.value;menu.replaceChildren(new Option(usableLeagues().length?'Vyberte soutěž a sezonu…':'Nabídka sezon zatím není načtená',''),...usableLeagues().map(l=>new Option(l.name,l.name)));menu.value=value;}
function populateContext(){
 const org=organizationById(orgId);
 fillLeagueMenu($('league'));$('league').value=context.league??'';$('work').value=context.work??'all';$('hub-org').textContent=org?.name??'Vyberte organizaci';
 $('organization-note').textContent=org?org.name+' · '+(context.league||'Vyberte sezonu pro Games View')+' · '+(org.ready?'Připojená organizace':'Připojení zatím není nastavené'):'Vyberte organizaci.';
 $('settings').disabled=!org;
}
async function loadLeagueCatalog(){
 const selectedOrg=orgId,version=++catalogRequest;if(!selectedOrg)return;
 if(!organizationById(orgId)?.ready){catalogMessage='Organizace zatím není připojená k HMS API. Nastavte její vlastní připojení ve Vercelu.';$('catalog-note').textContent=catalogMessage;return;}
 catalogMessage='Načítám názvy soutěží a sezon z HMS…';$('catalog-note').textContent=catalogMessage;
 try{
  const res=await fetch('/api/studio?'+new URLSearchParams({catalog:'leagues',org:currentOrgCode()}),{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error();const data=await res.json();if(selectedOrg!==orgId||version!==catalogRequest)return;
  if(data.org!==currentOrgCode()||!Array.isArray(data.items))throw Error();
  const incoming=data.items.filter(l=>validId(l.seasonId)&&typeof l.name==='string');
  const merged=new Map(usableLeagues().map(l=>[l.seasonId,l]));for(const l of incoming)merged.set(l.seasonId,l);
  context.leagues=[...merged.values()];
  if(!usableLeagues().some(l=>l.name===context.league))context.league='';
  catalogMessage=incoming.length?'Soutěže a sezony z načtených dat HMS. Stačí vybrat název.':'Pro tuto organizaci ještě nejsou načtené žádné sezony. Datové napojení musí doplnit správa HMS; žádné UID nepotřebujete.';
  persist();populateContext();render();fillLeagueMenu($('context-league'));$('context-league').value=context.league??'';$('catalog-note').textContent=catalogMessage;
 }catch{
  if(selectedOrg!==orgId||version!==catalogRequest)return;
  catalogMessage='Nabídku sezon se nepodařilo načíst. Obnovte ji prosím; pokud je prázdná, je potřeba doplnit datové připojení organizace. Žádné UID zadávat nemusíte.';$('catalog-note').textContent=catalogMessage;$('organization-note').textContent=catalogMessage;
 }
}
function selectOrg(){catalogRequest++;const requested=new URLSearchParams(location.search).get('org')??'phm';orgId=organizationById(requested)?.id??'';context=orgId?readContext(localStorage,orgId):{};$('organization').value=orgId;populateContext();render();loadLeagueCatalog();}
async function initializeOrganizations(){
 $('organization').disabled=true;
 try{setOrganizationCatalog(await loadOrganizationCatalog());$('organization').replaceChildren(...organizations.map(org=>new Option(org.name+(org.ready?'':' · Nepřipojeno'),org.id)));$('organization').disabled=false;selectOrg();}
 catch{$('organization-note').textContent='Seznam organizací nelze načíst. Obnovte stránku; jiné organizace se nepoužijí jako náhrada.';}
}
$('organization').onchange=()=>{const url=new URL(location.href);url.searchParams.set('org',$('organization').value);history.pushState(null,'',url);selectOrg();};addEventListener('popstate',selectOrg);
$('settings').onclick=showSettings;
$('league').onchange=()=>{context.league=$('league').value;persist();populateContext();render();};
$('work').onchange=()=>{context.work=$('work').value;persist();render();};
$('context-form').onsubmit=e=>{e.preventDefault();context.league=$('context-league').value;persist();$('context-dialog').close();populateContext();render();};
$('refresh-catalog').onclick=loadLeagueCatalog;
$('clear-context').onclick=()=>{context={};persist();$('context-dialog').close();populateContext();render();loadLeagueCatalog();};
$('view-map').onclick=()=>setView('map');$('view-list').onclick=()=>setView('list');$('search').oninput=render;$('status').onchange=render;$('reset').onclick=()=>{$('search').value='';$('status').value='all';context.work='all';category='all';populateContext();render();};
function setZoom(value){zoom=Math.max(.45,Math.min(1.4,value));$('map-stage').style.transform=`scale(${zoom})`;$('zoom-label').textContent=Math.round(zoom*100)+' %';requestAnimationFrame(drawConnections);}
$('zoom-in').onclick=()=>setZoom(zoom+.1);$('zoom-out').onclick=()=>setZoom(zoom-.1);$('fit').onclick=()=>{setZoom(($('viewport').clientWidth-20)/$('map-stage').offsetWidth);$('viewport').scrollTo(0,0);};
$('work-chats').onclick=showWorkChats;
$('help').onclick=()=>{$('detail-title').textContent='Jak se v mapě orientovat';$('detail-phase').textContent='HMS → OBLAST → NÁSTROJ';$('detail-note').textContent='Vyberte organizaci a případně sezonu. Konkrétní zápas vyberete uvnitř nástroje. Kliknutím na velký název nodu otevřete nástroj. Odkaz Řešit v chatu otevře související pracovní chat. Přehled Chaty a Worky obsahuje celé názvy pro dohledání. Podrobnosti ukazují zdroje, GitHub a omezení. Větve sdružují nástroje podle oblasti. Pracuji jako zúží mapu i seznam na nástroje pro vybranou roli. Mapu posouvejte tažením pozadí nebo pomocí posuvníků; tlačítko Celá mapa ji oddálí. Všechny původní odkazy najdete v druhém pohledu.';$('detail-links').replaceChildren();$('detail-dialog').showModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
let drag=null;$('viewport').onpointerdown=e=>{if(e.target.closest('button,a,input,select,.node'))return;drag={x:e.clientX,y:e.clientY,left:$('viewport').scrollLeft,top:$('viewport').scrollTop};$('viewport').setPointerCapture(e.pointerId);};$('viewport').onpointermove=e=>{if(drag){$('viewport').scrollLeft=drag.left-(e.clientX-drag.x);$('viewport').scrollTop=drag.top-(e.clientY-drag.y);}};$('viewport').onpointerup=$('viewport').onpointercancel=()=>drag=null;$('viewport').addEventListener('scroll',()=>requestAnimationFrame(drawConnections));addEventListener('resize',()=>requestAnimationFrame(drawConnections));
initializeOrganizations();
