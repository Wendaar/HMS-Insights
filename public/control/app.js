import {organizations, organizationById, appsForOrganization, categories, statuses, linkLabels, gameReportUrl, filterApps} from './registry.js';
const $ = id => document.getElementById(id);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let orgId, category = 'all';
for (const org of organizations) {
  const option = element('option',org.name + (org.ready?'':' · připraveno')); option.value = org.id; $('organization').append(option);
}
for (const [value,label] of Object.entries(statuses)) {
  const option=element('option',label); option.value=value; $('status').append(option);
}
function link(href, label) {
  const a=element('a',label); a.href=href;
  if (href.startsWith('https://')) { a.target='_blank'; a.rel='noopener noreferrer'; }
  return a;
}
function card(app) {
  const article=element('article',null,'card'); article.dataset.app=app.id;
  const head=element('div',null,'card-heading');
  head.append(element('span',app.name.split(' ').map(w=>w[0]).slice(0,2).join(''),'app-icon'),element('span',statuses[app.status],`badge ${app.status}`));
  article.append(head,element('h4',app.name),element('p',app.description,'description'));
  const data=element('div',null,'data-source'); data.append(element('span','Zdroj dat'),element('p',app.dataSource)); article.append(data);
  if(app.note) article.append(element('p',app.note,'note'));
  const links=element('div',null,'card-links');
  for(const [key,label] of Object.entries(linkLabels)) {
    const href=app.links[key];
    if(href) { const a=link(href,label); a.title=`${label} · ${app.name}`; links.append(a); }
    else { const span=element('span',label,'unset'); span.title=`${label}: Nenastaveno`; span.setAttribute('aria-label',`${label}: Nenastaveno`); links.append(span); }
  }
  article.append(links);
  if(!Object.keys(app.links).length) article.append(element('small','Odkazy: Nenastaveno','missing-links'));
  if(app.id==='game-center'&&app.gamePath) { const a=link('#game-id','Zadat Game ID ↑');a.className='game-shortcut';a.onclick=()=>{$('game-id').focus();};article.append(a); }
  return article;
}
function render() {
  const apps=appsForOrganization(orgId), filtered=filterApps(apps,{query:$('search').value,status:$('status').value,category});
  $('result-count').textContent=`Zobrazeno ${filtered.length} z ${apps.length} · ${apps.filter(a=>a.status==='available').length} dostupných`;
  $('categories').replaceChildren();
  for(const c of [{id:'all',name:'Vše'},...categories]) {
    const count=apps.filter(a=>c.id==='all'||a.category===c.id).length;
    const b=element('button',`${c.name} · ${count}`);b.type='button';b.setAttribute('aria-pressed',String(category===c.id));b.onclick=()=>{category=c.id;render();};$('categories').append(b);
  }
  $('applications').replaceChildren();
  for(const c of categories) {
    const entries=filtered.filter(a=>a.category===c.id);if(!entries.length)continue;
    const section=element('section',null,'category-section');section.setAttribute('aria-labelledby',`category-${c.id}`);
    const title=element('h3',c.name);title.id=`category-${c.id}`;
    const grid=element('div',null,'cards');entries.forEach(app=>grid.append(card(app)));
    section.append(title,element('p',c.description,'category-description'),grid);$('applications').append(section);
  }
  $('empty').hidden=filtered.length!==0;
}
function updateGameLink() {
  const url=gameReportUrl(orgId,$('game-id').value);
  $('game-url').hidden=!url;$('game-url').textContent=url?`Report: ${url}`:'';
  if(url)$('game-url').href=url;
  $('game-error').textContent='';$('game-id').removeAttribute('aria-invalid');
}
function selectOrganization() {
  const requested=new URLSearchParams(location.search).get('org')??'phm';
  const org=organizationById(requested); orgId=org?.id??null;
  $('organization').value=orgId??'';
  $('organization-note').textContent=org?`${org.name} · ${org.description}`:'Neznámá organizace. Vyberte organizaci z nabídky; žádná data PHM se automaticky nepoužijí.';
  $('organization-note').classList.toggle('pending',!org?.ready);
  const canOpen=!!appsForOrganization(orgId).find(a=>a.gamePath);
  $('game-id').disabled=!canOpen;$('game-form').querySelector('button').disabled=!canOpen;
  $('game-help').textContent=canOpen?'Vložte Game ID z HMS. Otevře se existující report importovaného zápasu.':'Game Center pro tuto organizaci: Nenastaveno. Nejprve ověřte její vlastní adresu a připojení.';
  $('game-id').value=''; updateGameLink();render();
}
$('organization').onchange=()=>{const url=new URL(location.href);url.searchParams.set('org',$('organization').value);history.pushState(null,'',url);selectOrganization();};
window.addEventListener('popstate',selectOrganization);
$('search').oninput=render;$('status').onchange=render;
$('reset').onclick=()=>{category='all';$('search').value='';$('status').value='all';render();$('search').focus();};
$('game-id').oninput=updateGameLink;
$('game-form').onsubmit=event=>{
  event.preventDefault();const url=gameReportUrl(orgId,$('game-id').value);
  if(url)location.assign(url);
  else {$('game-error').textContent='Vložte platné Game ID ve formátu UUID (8-4-4-4-12 znaků).';$('game-id').setAttribute('aria-invalid','true');$('game-id').focus();}
};
selectOrganization();
