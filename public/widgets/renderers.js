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
 const promise=fetch('/api/widgets?'+q,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).catch(e=>{requests.delete(key);throw e;});
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
export async function renderLeaders(container,instance,options){
 const {lang='cs',pageContext={},siteContext={},signal}=options,en=lang==='en',definition=metrics[instance.metric];
 container.className='hms-widget leaders-widget';container.dataset.mode=instance.display.mode;container.dataset.neutral=String(!!definition.neutral);
 container.setAttribute('aria-busy','true');container.innerHTML=`<p role="status">${en?'Loading HMS statistics…':'Načítám statistiky HMS…'}</p>`;
 try{
  const scope=resolveWidgetContext(instance.scope,pageContext,siteContext);
  const data=await widgetData(options.org,scope,{metric:instance.metric,limit:String(instance.limit)});if(signal?.aborted||!container.isConnected)return;
  const format=v=>new Intl.NumberFormat(en?'en-GB':'cs-CZ',{minimumFractionDigits:definition.digits??0,maximumFractionDigits:definition.digits??2}).format(v),leader=data.items[0],brand=data.branding??{};
  if(/^#[a-f0-9]{6}$/i.test(brand.color??''))container.style.setProperty('--widget-accent',brand.color);
  const team=p=>`${instance.display.showTeamLogo&&p.teamLogoUrl?`<img class="leader-team-logo" src="${esc(p.teamLogoUrl)}" alt="" loading="lazy">`:''}<span>${esc(p.team)}</span>`;
  container.innerHTML=`<header class="leaders-heading">${instance.display.showScopeBranding&&brand.logoUrl?`<img src="${esc(brand.logoUrl)}" alt="">`:''}<div><span class="eyebrow">${instance.display.showScopeBranding?esc(brand.name):'HMS'} · TOP ${instance.limit}</span><h3>${esc(definition[lang]??definition.cs)}</h3></div></header>${leader?`<div class="leaders-body">${definition.neutral?'':`<button class="leader-feature" type="button" data-player-id="${esc(leader.id)}" data-team-id="${esc(leader.teamId)}" aria-haspopup="dialog">${instance.display.showPlayerPhoto?portrait(leader):''}<span class="leader-feature-info"><strong>${esc(leader.name)}</strong><span class="leader-team">${team(leader)}</span><small>${esc([leader.number!=null?'#'+leader.number:null,leader.position].filter(Boolean).join(' · '))}</small><b class="leader-value">${format(leader.value)}</b></span></button>`}<ol class="leader-ranking">${data.items.map(p=>`<li value="${p.rank}"><button type="button" data-player-id="${esc(p.id)}" data-team-id="${esc(p.teamId)}" aria-haspopup="dialog"><b class="leader-rank">${p.tied?'T':''}${p.rank}.</b>${instance.display.showPlayerPhoto?portrait(p):''}<span class="leader-person"><strong>${esc(p.name)}</strong><small class="leader-team">${team(p)}</small></span><b>${format(p.value)}</b></button></li>`).join('')}</ol></div><p class="leaders-source">${en?'Official HMS statistics':'Oficiální statistiky HMS'}</p>`:`<p role="status">${en?'No players are available for this selection.':'Pro tento výběr zatím nejsou dostupné statistiky hráčů.'}</p>`}`;
  if(leader)playerDialog(container,data.items,{...options,lang},data.scope,definition.role);
 }catch(e){if(signal?.aborted)return;container.innerHTML=`<p class="notice error" role="alert">${esc(e.message??(en?'Statistics unavailable.':'Statistiky nejsou dostupné.'))}</p><button type="button">${en?'Try again':'Zkusit znovu'}</button>`;container.querySelector('button').onclick=()=>renderLeaders(container,instance,options);}
 finally{container.removeAttribute('aria-busy');}
}
const renderers={
 leaders:renderLeaders,
 insights:async(container,instance,options)=>{container.className='hms-widget insights-widget';await mountInsightsCarousel(container,{org:options.org,lang:options.lang,allHref:options.insightsHref??('/priklepy/'+options.org+'?'+new URLSearchParams({lang:options.lang??'cs'})),openAllInNewTab:options.standalone===true,signal:options.signal});if(!options.signal?.aborted&&!container.children.length)container.textContent=options.lang==='en'?'No highlights are available yet.':'Zatím nejsou dostupné žádné Příklepy.';},
};
export async function mountWidget(container,input,options={}){
 const instance=normalizeWidget(input);if(!instance.enabled||options.signal?.aborted)return;
 container.dataset.widgetInstanceId=instance.widgetInstanceId;
 await renderers[widgetRegistry[instance.widgetType].renderer](container,instance,options);
}
export function mountWidgets(container,instances,options){
 return Promise.allSettled(instances.filter(w=>w.enabled!==false).map(w=>{const host=document.createElement('section');container.append(host);return mountWidget(host,w,options);}));
}
