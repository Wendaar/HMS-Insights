import {stripCardMarkup,stripDateMarkup} from './strip-view.js';
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
 container.className='hms-widget game-strip';container.setAttribute('aria-label',en?'Games':'Zápasy');
 let track,observer,dates=[],activeDate,scrollTimer,activeRequests=0;const queue=[],states=new Map();
 const alive=()=>container.isConnected&&!options.signal?.aborted;
 const fetchDay=(date,offset=0)=>widgetData(options.org,scope,{action:'game-strip',...(date?{date}:{}),offset:String(offset)});
 function openCard(card,open){
  const nav=card.querySelector('.strip-overlay'),toggle=card.querySelector('.strip-toggle');
  if(!nav)return;nav.hidden=!open;card.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
 }
 function bindCards(root){
  root.querySelectorAll('.strip-card').forEach(card=>{
   const toggle=card.querySelector('.strip-toggle');if(!toggle||card.dataset.stripBound)return;card.dataset.stripBound='true';
   toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';container.querySelectorAll('.strip-card.is-open').forEach(c=>openCard(c,false));openCard(card,open);};
   card.querySelector('.strip-overlay').onclick=e=>{if(e.target===e.currentTarget)openCard(card,false);};
   card.onpointerenter=e=>{if(e.pointerType==='mouse')openCard(card,true);};
   card.onpointerleave=e=>{if(e.pointerType==='mouse'&&!card.contains(document.activeElement))openCard(card,false);};
   card.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))openCard(card,true);});
   card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget))openCard(card,false);});
   card.onkeydown=e=>{if(e.key==='Escape'){openCard(card,false);toggle.focus({preventScroll:true});openCard(card,false);e.stopPropagation();}};
   card.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.hidden=true;});
  });
 }
 function updateControls(){
  const index=dates.indexOf(activeDate);container.querySelector('[data-strip-prev]').disabled=index<=0;container.querySelector('[data-strip-next]').disabled=index>=dates.length-1;
 }
 function move(direction){
  const index=dates.indexOf(activeDate),date=dates[index+direction];if(!date)return;
  activeDate=date;updateControls();ensure(date);
  track.scrollTo({left:states.get(date).node.offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function observeMore(state){
  const more=state.node.querySelector('[data-strip-more]');if(!more)return;
  more.onclick=()=>ensure(state.date);observer?.observe(more);
 }
 function paint(state,data,append=false){
  const content=state.node.querySelector('.strip-day-content'),oldWidth=state.node.offsetWidth,oldScroll=track.scrollLeft,adjust=state.node.offsetLeft<oldScroll-1;
  const focused=content.contains(document.activeElement);
  content.querySelector('[data-strip-more]')?.remove();
  const cards=data.items.map(g=>stripCardMarkup(g,instance,options.lang)).join('');
  if(append)content.insertAdjacentHTML('beforeend',cards);else content.innerHTML=cards;
  state.loaded=true;state.offset=data.offset+data.items.length;state.hasMore=data.hasMore;
  if(data.hasMore)content.insertAdjacentHTML('beforeend',`<button type="button" class="strip-inline-load" data-strip-more aria-label="${en?'Load more games':'Načíst další zápasy'}">…</button>`);
  bindCards(content);observeMore(state);
  if(adjust)track.scrollLeft=oldScroll+state.node.offsetWidth-oldWidth;
  if(focused){const target=content.querySelector('[data-strip-more],.strip-toggle')??track;target.focus({preventScroll:true});}
 }
 function pump(){
  while(activeRequests<2&&queue.length){const state=queue.shift();activeRequests++;
   fetchDay(state.date,state.loaded?state.offset:0).then(data=>{if(alive())paint(state,data,state.loaded);}).catch(()=>{
    if(!alive())return;
    const content=state.node.querySelector('.strip-day-content');content.querySelector('[data-strip-more]')?.remove();
    const button=document.createElement('button');button.type='button';button.className='strip-inline-load strip-load-error';button.textContent=en?'Retry':'Zkusit znovu';button.onclick=()=>{button.remove();ensure(state.date);};content.append(button);
    container.querySelector('.strip-feedback').textContent=en?'Some games could not be loaded. Retry in the strip.':'Některé zápasy se nepodařilo načíst. Zkuste to znovu v pásu.';
   }).finally(()=>{state.pending=false;activeRequests--;if(alive())pump();});
  }
 }
 function ensure(date){
  const state=states.get(date);if(!state||state.pending||state.loaded&&!state.hasMore||!alive())return;
  state.pending=true;queue.push(state);pump();
 }
 async function start(){
  container.setAttribute('aria-busy','true');container.innerHTML=`<p role="status">${en?'Loading games…':'Načítám zápasy…'}</p>`;
  try{
   const data=await fetchDay();if(!alive())return;
   if(!data.date){container.innerHTML=`<p role="status">${en?'No games are available for this selection.':'Pro tento výběr nejsou dostupné žádné zápasy.'}</p>`;return;}
   dates=data.dates;activeDate=data.date;
   container.innerHTML=`<button type="button" class="strip-arrow" data-strip-prev aria-label="${en?'Previous playing day':'Předchozí hrací den'}">‹</button><div class="strip-track" tabindex="0" role="region" aria-label="${en?'Games · swipe to browse playing days':'Zápasy · posunem procházejte hrací dny'}"></div><button type="button" class="strip-arrow" data-strip-next aria-label="${en?'Next playing day':'Následující hrací den'}">›</button><span class="strip-feedback strip-sr" aria-live="polite"></span>`;
   track=container.querySelector('.strip-track');
   if(/^#[a-f0-9]{6}$/i.test(data.branding?.color??''))container.style.setProperty('--widget-accent',data.branding.color);
   for(const date of dates){
    const node=document.createElement('section');node.className='strip-day';node.dataset.stripDay=date;node.setAttribute('aria-label',date);
    node.innerHTML=stripDateMarkup(date,options.lang)+'<div class="strip-day-content"><button class="strip-inline-load" type="button" data-strip-more aria-label="'+(en?'Load games':'Načíst zápasy')+'">…</button></div>';
    track.append(node);states.set(date,{date,node,loaded:false,pending:false,offset:0,hasMore:false});
   }
   paint(states.get(data.date),data);track.scrollLeft=states.get(data.date).node.offsetLeft;
   observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);ensure(entry.target.closest('[data-strip-day]').dataset.stripDay);}},{root:track,rootMargin:'0px 180px'}):null;
   for(const state of states.values())observeMore(state);
   container.querySelector('[data-strip-prev]').onclick=()=>move(-1);container.querySelector('[data-strip-next]').onclick=()=>move(1);updateControls();
   track.onkeydown=e=>{if(e.target!==track||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();move(e.key==='ArrowLeft'?-1:1);};
   track.onscroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{
    if(!alive())return;
    if(track.scrollLeft>=track.scrollWidth-track.clientWidth-2)activeDate=dates.at(-1);
    else activeDate=dates.filter(d=>states.get(d).node.offsetLeft<=track.scrollLeft+8).at(-1)??dates[0];
    updateControls();
    // Native touch/trackpad scrolling reaches the same lazy day loaders.
    if(!observer)for(const state of states.values()){const x=state.node.offsetLeft-track.scrollLeft;if(x<track.clientWidth+180&&x+state.node.offsetWidth>-180)ensure(state.date);}
   },120);};
   track.addEventListener('pointerdown',e=>{if(!e.target.closest('.strip-card.is-open'))container.querySelectorAll('.strip-card.is-open').forEach(c=>openCard(c,false));});
  }catch(e){if(!alive())return;container.innerHTML=`<p role="alert">${en?'Games could not be loaded.':'Zápasy se nepodařilo načíst.'}</p><button type="button">${en?'Retry':'Zkusit znovu'}</button>`;container.querySelector('button').onclick=start;}
  finally{container.removeAttribute('aria-busy');}
 }
 options.signal?.addEventListener('abort',()=>{observer?.disconnect();clearTimeout(scrollTimer);queue.length=0;},{once:true});
 await start();
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
