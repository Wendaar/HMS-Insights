import {gameReportNavigation} from '../games/navigation.js';
import {portrait} from '../player-portrait.js';
import {widgetRegistry,normalizeWidget,resolveWidgetContext,metrics} from './definitions.js';
import {mountInsightsCarousel} from '../insights-carousel.js';
import {createPlayerCard} from '../player-card.js';
import {localizeReportNode} from '../game-report-i18n.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requests=new Map();
export function widgetData(org,scope,extra={}){
 const q=new URLSearchParams({org,...Object.fromEntries(Object.entries(scope).filter(([,v])=>v!=null)),...extra}),key=q.toString();
 if(requests.get(key)?.until>Date.now())return requests.get(key).promise;
 const promise=fetch('/api/widgets?'+q,{headers:{accept:'application/json'},signal:AbortSignal.timeout(35000)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).catch(e=>{requests.delete(key);throw e;});
 if(requests.size>=100)requests.delete(requests.keys().next().value);requests.set(key,{promise,until:Date.now()+60000});return promise;
}
function playerDialog(container,items,options,scope,role){
 const dialog=document.createElement('dialog');dialog.className='hms-player-card';
 const titleId='player-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',titleId);
 dialog.innerHTML=`<div class="event-dialog-head"><p class="eyebrow">${options.lang==='en'?'PLAYER CARD':'HRÁČSKÁ KARTA'}</p><button type="button" aria-label="${options.lang==='en'?'Close':'Zavřít'}">×</button></div><h2 id="${titleId}"></h2><div class="player-card-content" aria-live="polite"></div>`;
 container.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
 const open=createPlayerCard({dialog,title:dialog.querySelector('h2'),content:dialog.querySelector('.player-card-content'),lang:options.lang,localize:n=>localizeReportNode(n,options.lang,items.flatMap(p=>[p.name,p.team])),knownPlayer:id=>items.find(p=>p.id===id),loadCard:(playerId,person)=>widgetData(options.org,{...scope,...(person?.teamId?{teamId:person.teamId}:{})},{action:'player-card',role,playerId})});
 container.querySelectorAll('[data-player-id]').forEach(b=>b.onclick=()=>open(b.dataset.playerId,items.find(p=>p.id===b.dataset.playerId&&p.teamId===b.dataset.teamId)));
 options.signal?.addEventListener('abort',()=>{if(dialog.open)dialog.close();dialog.remove();},{once:true});
}
export async function renderLeaders(container,instance,options,selection={}){
 const {lang='cs',pageContext={},siteContext={},signal}=options,en=lang==='en',definition=metrics[instance.metric];
 container.className='hms-widget leaders-widget';container.dataset.mode=instance.display.mode;container.dataset.neutral=String(!!definition.neutral);
 container.setAttribute('aria-busy','true');container.innerHTML=`<p role="status">${en?'Loading HMS statistics…':'Načítám statistiky HMS…'}</p>`;
 try{
  const scope=resolveWidgetContext(instance.scope,pageContext,siteContext);
  const data=await widgetData(options.org,scope,{metric:instance.metric,limit:String(instance.limit),allowPhaseSwitching:String(instance.allowPhaseSwitching),...selection});if(signal?.aborted||!container.isConnected)return;
  const format=v=>new Intl.NumberFormat(en?'en-GB':'cs-CZ',{minimumFractionDigits:definition.digits??0,maximumFractionDigits:definition.digits??2}).format(v),leader=data.items[0],brand=data.branding??{};
  if(/^#[a-f0-9]{6}$/i.test(brand.color??''))container.style.setProperty('--widget-accent',brand.color);
  const team=p=>`${instance.display.showTeamLogo&&p.teamLogoUrl?`<img class="leader-team-logo" src="${esc(p.teamLogoUrl)}" alt="" loading="lazy">`:''}<span>${esc(p.team)}</span>`;
  container.innerHTML=`<header class="leaders-heading">${instance.display.showScopeBranding&&brand.logoUrl?`<img src="${esc(brand.logoUrl)}" alt="">`:''}<div><span class="eyebrow">${instance.display.showScopeBranding?esc(brand.name):'HMS'} · TOP ${instance.limit}</span><h3>${esc(definition[lang]??definition.cs)}</h3>${brand.phase?`<small class="leaders-phase-label">${esc(brand.phase)}</small>`:''}</div></header>${data.phaseOptions?.length?`<label class="leaders-phase-control">${en?'Phase':'Fáze'}<select aria-label="${en?'Phase':'Fáze'}"><option value="all">${en?'Whole season':'Celá sezóna'}</option>${data.phaseOptions.map(p=>`<option value="${esc(p.id)}" ${data.scope.phaseId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}${leader?`<div class="leaders-body">${definition.neutral?'':`<button class="leader-feature" type="button" data-player-id="${esc(leader.id)}" data-team-id="${esc(leader.teamId)}" aria-haspopup="dialog">${instance.display.showPlayerPhoto?portrait(leader):''}<span class="leader-feature-info"><strong>${esc(leader.name)}</strong><span class="leader-team">${team(leader)}</span><small>${esc([leader.number!=null?'#'+leader.number:null,leader.position].filter(Boolean).join(' · '))}</small><b class="leader-value">${format(leader.value)}</b></span></button>`}<ol class="leader-ranking">${data.items.map((p,index)=>`<li value="${index+1}" data-stat-rank="${p.rank}"><button type="button" data-player-id="${esc(p.id)}" data-team-id="${esc(p.teamId)}" aria-haspopup="dialog"><b class="leader-rank">${index+1}.</b>${instance.display.showPlayerPhoto?portrait(p):''}<span class="leader-person"><strong>${esc(p.name)}</strong><small class="leader-team">${team(p)}</small></span><b>${format(p.value)}</b></button></li>`).join('')}</ol></div><p class="leaders-source">${en?'Official HMS statistics':'Oficiální statistiky HMS'}</p>`:`<p role="status">${en?'No players are available for this selection.':'Pro tento výběr zatím nejsou dostupné statistiky hráčů.'}</p>`}`;
  container.querySelector('.leaders-phase-control select')?.addEventListener('change',e=>{renderLeaders(container,instance,options,{visitorPhaseId:e.target.value});});
  if(leader)playerDialog(container,data.items,{...options,lang},data.scope,definition.role);
 }catch(e){if(signal?.aborted)return;container.innerHTML=`<p class="notice error" role="alert">${esc(e.message??(en?'Statistics unavailable.':'Statistiky nejsou dostupné.'))}</p><button type="button">${en?'Try again':'Zkusit znovu'}</button>`;container.querySelector('button').onclick=()=>renderLeaders(container,instance,options,selection);}
 finally{container.removeAttribute('aria-busy');}
}
export async function renderGameStrip(container,instance,options){
 const en=options.lang==='en',scope=resolveWidgetContext(instance.scope,options.pageContext,options.siteContext);
 let selected,offset=0,generation=0;
 container.className='hms-widget game-strip';
 async function load(date,append=false){
  const active=container.contains(document.activeElement)?document.activeElement:null,focusSelector=active?.hasAttribute('data-today')?'[data-today]':active?.hasAttribute('data-prev')?'[data-prev]':active?.hasAttribute('data-next')?'[data-next]':active?.tagName==='SELECT'?'select':null;
  const current=++generation;container.setAttribute('aria-busy','true');
  if(!container.children.length)container.innerHTML=`<p role="status">${en?'Loading games…':'Načítám zápasy…'}</p>`;
  try{
   const data=await widgetData(options.org,scope,{action:'game-strip',...(date?{date}:{}),offset:String(append?offset:0)});
   if(current!==generation||options.signal?.aborted||!container.isConnected)return;
   selected=data.date;offset=data.offset+data.items.length;
   const format=d=>new Intl.DateTimeFormat(en?'en-GB':'cs-CZ',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
   const status=g=>({FINISHED:en?'Final':'Konec',RUNNING:en?'In progress':'Probíhá','NOT PLAYED':en?'Scheduled':'Plánováno',CANCELLED:en?'Cancelled':'Zrušeno',POSTPONED:en?'Postponed':'Odloženo'}[g.status]??(g.live?(en?'In progress':'Probíhá'):g.status==='UNKNOWN'?(en?'Status unavailable':'Stav není dostupný'):g.status));
   const team=t=>`<div class="strip-team">${instance.display.showTeamLogo&&t.logoUrl?`<img src="${esc(t.logoUrl)}" alt="" loading="lazy">`:''}<strong title="${esc(t.name)}">${esc(t.shortName??t.name??(en?'Team to be announced':'Tým bude upřesněn'))}</strong>${t.rank!=null?`<small title="${esc(t.rankGroup)}">${t.rank}. <span>${esc(t.rankGroup)}</span></small>`:''}${t.score!=null?`<b>${t.score}</b>`:''}</div>`;
   const cards=data.items.map(g=>`<article class="strip-card" aria-label="${esc([g.home.name,g.away.name].filter(Boolean).join(' – '))}"><div class="strip-meta"><span>${esc(status(g))}</span>${g.time?`<time datetime="${g.date}T${g.time}">${g.time}</time>`:''}</div>${team(g.home)}${team(g.away)}${g.reportUrl||g.detailUrl||g.media?.albumUrl||g.media?.youtubeUrl?`<details class="strip-actions"><summary>${en?'Game links':'Odkazy k zápasu'} ↗</summary><nav aria-label="${en?'Game links':'Odkazy k zápasu'}">${g.reportUrl?`<a href="${esc(gameReportNavigation(g.id,options.lang,true).href)}" target="_blank" rel="noopener noreferrer">Game Report ↗</a>`:g.detailUrl?`<a href="${esc(g.detailUrl)}" target="_blank" rel="noopener noreferrer">HMS detail ↗</a>`:''}${g.media?.albumUrl?`<a href="${esc(g.media.albumUrl)}" target="_blank" rel="noopener noreferrer">▧ ${en?'Photos':'Fotografie'}</a>`:''}${g.media?.youtubeUrl?`<a href="${esc(g.media.youtubeUrl)}" target="_blank" rel="noopener noreferrer">▶ ${en?'Video':'Přenos / video'}</a>`:''}</nav></details>`:''}</article>`).join('');
   if(append)container.querySelector('.strip-track').insertAdjacentHTML('beforeend',cards);
   else{
    container.innerHTML=`<header class="strip-heading"><div><span class="eyebrow">${esc(data.branding?.name??'HMS')}</span><h3>${en?'Game Strip':'Zápasový pás'}</h3></div><button type="button" data-today>${en?'Today / next games':'Dnes / nejbližší zápasy'}</button></header><nav class="strip-days" aria-label="${en?'Playing days':'Hrací dny'}"><button type="button" data-prev ${data.previous?'':'disabled'} aria-label="${en?'Previous playing day':'Předchozí hrací den'}">‹</button><select aria-label="${en?'Playing day':'Hrací den'}">${data.dates.map(d=>`<option value="${d}" ${d===data.date?'selected':''}>${format(d)}</option>`).join('')}</select><button type="button" data-next ${data.next?'':'disabled'} aria-label="${en?'Next playing day':'Následující hrací den'}">›</button><span>${esc(data.timeZone)}</span></nav><div class="strip-scroll"><button type="button" data-scroll="-1" aria-label="${en?'Scroll games back':'Posunout zápasy zpět'}">‹</button><div class="strip-track" tabindex="0" role="region" aria-label="${en?'Games':'Zápasy'}">${cards||`<p role="status">${en?'No games are available for this selection.':'Pro tento výběr nejsou dostupné žádné zápasy.'}</p>`}</div><button type="button" data-scroll="1" aria-label="${en?'Scroll games forward':'Posunout zápasy vpřed'}">›</button></div><p class="strip-source">${en?'HMS snapshot':'Snímek HMS'} · ${esc(new Intl.DateTimeFormat(en?'en-GB':'cs-CZ',{dateStyle:'short',timeStyle:'short',timeZone:data.timeZone}).format(new Date(data.readAt)))}</p><div class="strip-feedback" aria-live="polite"></div><button type="button" data-more>${en?'Load more games':'Načíst další zápasy'}</button>`;
    if(/^#[a-f0-9]{6}$/i.test(data.branding?.color??''))container.style.setProperty('--widget-accent',data.branding.color);
    container.querySelector('[data-today]').onclick=()=>load();
    container.querySelector('select').onchange=e=>load(e.target.value);
    container.querySelector('[data-prev]').onclick=()=>load(data.previous);
    container.querySelector('[data-next]').onclick=()=>load(data.next);
    container.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>container.querySelector('.strip-track').scrollBy({left:Number(b.dataset.scroll)*300,behavior:'smooth'}));
   }
   const more=container.querySelector('[data-more]');more.hidden=!data.hasMore;more.onclick=()=>load(selected,true);
   container.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.hidden=true;});
   container.querySelectorAll('.strip-card').forEach(card=>{card.onfocusin=e=>{if(e.target.matches(':focus-visible')){const actions=card.querySelector('details');if(actions)actions.open=true;}};card.onpointerenter=e=>{if(e.pointerType==='mouse'){const actions=card.querySelector('details');if(actions)actions.open=true;}};card.onpointerleave=()=>{if(!card.contains(document.activeElement)){const actions=card.querySelector('details');if(actions)actions.open=false;}};});
   if(focusSelector&&!append)(container.querySelector(focusSelector+':not(:disabled)')??container.querySelector('select')).focus({preventScroll:true});
  }catch(e){if(current!==generation||options.signal?.aborted)return;const host=container.querySelector('.strip-feedback')??container;host.innerHTML=`<p role="alert">${en?'Games could not be loaded.':'Zápasy se nepodařilo načíst.'}</p><button type="button">${en?'Retry':'Zkusit znovu'}</button>`;host.querySelector('button').onclick=()=>load(date,append);}
  finally{if(current===generation)container.removeAttribute('aria-busy');}
 }
 await load();
}
const renderers={
 'game-strip':renderGameStrip,
 leaders:renderLeaders,
 insights:async(container,instance,options)=>{container.className='hms-widget insights-widget';await mountInsightsCarousel(container,{org:options.org,lang:options.lang,allHref:options.insightsHref??('/priklepy/'+options.org+'?'+new URLSearchParams({lang:options.lang??'cs'})),openAllInNewTab:options.standalone===true,signal:options.signal});if(!options.signal?.aborted&&!container.children.length)container.textContent=options.lang==='en'?'No highlights are available yet.':'Zatím nejsou dostupné žádné Příklepy.';},
};
export async function mountWidget(container,input,options={}){
 const instance=normalizeWidget(input);if(!instance.enabled||options.signal?.aborted)return;
 container.dataset.widgetInstanceId=instance.widgetInstanceId;
 await renderers[widgetRegistry[instance.widgetType].renderer](container,instance,options);
}
export function mountWidgets(container,instances,options){
 return Promise.allSettled(instances.filter(w=>w.enabled!==false).map(input=>{const w=normalizeWidget(input),cell=document.createElement('div'),host=document.createElement('section');cell.className='widget-cell';cell.dataset.width=w.layout.width;cell.append(host);container.append(cell);return mountWidget(host,w,options);}));
}
