import {insightCopy,insightStat,feedLocale} from './insights-i18n.js';
import {sportingImage} from './game-report-media.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=value=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value??'');
export function carouselItems(data,org){
 if(data?.organization!==org.toUpperCase()||!Array.isArray(data.items))throw Error('Unexpected Insights organization');
 return data.items.filter(item=>uuid(item.gameId)&&/^\d{4}-\d{2}-\d{2}$/.test(item.date??''))
  .slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.importance??0)-(a.importance??0)).slice(0,8);
}
export function carouselCard(original,lang,index,total){
 const item=insightCopy(original,lang),en=lang==='en',subject=item.player||item.team;
 const portrait=sportingImage(item.playerImageUrl),logo=sportingImage(item.teamLogoUrl),group=sportingImage(item.groupLogoUrl);
 const image=portrait||logo,initials=String(subject??'HMS').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('');
 const date=new Intl.DateTimeFormat(feedLocale(lang),{day:'numeric',month:'short',year:'numeric'}).format(new Date(item.date+'T12:00:00Z'));
 return `<article class="ic-slide" aria-roledescription="${en?'slide':'snímek'}" aria-label="${index+1} / ${total}">
  <div class="ic-art" aria-hidden="true">${image?`<img class="${portrait?'ic-photo':'ic-team-art'}" src="${esc(image)}" alt="" ${index?'loading="lazy"':'fetchpriority="high"'} decoding="async" referrerpolicy="no-referrer">`:`<span class="ic-initials">${esc(initials)}</span>`}</div>
  <div class="ic-shade"></div>
  <header class="ic-card-head"><span>${en?'FROM THE ICE':'Z LEDU'}</span><span class="ic-group">${group?`<img src="${esc(group)}" alt="">`:''}${esc(item.group)}</span></header>
  <div class="ic-copy"><span class="ic-type">${esc(item.title)}</span><strong class="ic-stat">${esc(insightStat(item,lang))}</strong><h3>${esc(subject)}</h3><p>${esc(item.text)}</p></div>
  <footer class="ic-foot"><div class="ic-game"><span>${esc(item.homeTeam)}</span><b>${esc(item.homeScore)} : ${esc(item.awayScore)}</b><span>${esc(item.awayTeam)}</span></div><div class="ic-meta"><span>${esc(date)}</span><a href="/game-center/${esc(item.gameId)}/public?lang=${lang}" target="_blank" rel="noopener noreferrer">${en?'Game report':'Report zápasu'} ↗</a></div></footer>
 </article>`;
}
// A shared view of the existing public selection: no separate feed or publishing
// rules. Native scrolling supplies touch/swipe, with explicit keyboard controls.
export async function mountInsightsCarousel(container,{org,lang='cs',allHref,signal,fetchImpl=fetch}){
 const en=lang==='en',section=document.createElement('section');section.className='insights-carousel';section.hidden=true;
 section.setAttribute('aria-label',en?'Latest Insights':'Nejnovější Příklepy');section.setAttribute('aria-roledescription','carousel');container.prepend(section);
 try{
  const response=await fetchImpl('/api/selection?'+new URLSearchParams({org:org.toUpperCase(),lang}),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Insights unavailable');
  const items=carouselItems(await response.json(),org);if(signal?.aborted||!section.isConnected)return;
  if(!items.length){section.remove();return;}
  section.innerHTML=`<div class="ic-heading"><div><span class="eyebrow">${en?'LATEST FROM THE ORGANIZATION':'NEJNOVĚJŠÍ Z CELÉ ORGANIZACE'}</span><h3>${en?'The best from the ice':'To nejlepší z ledu'}</h3></div><a href="${esc(allHref)}">${en?'All Insights':'Všechny Příklepy'} →</a></div><div class="ic-track" tabindex="0" aria-label="${en?'Highlights. Use arrow keys to browse.':'Příklepy. Procházejte šipkami.'}">${items.map((item,index)=>carouselCard(item,lang,index,items.length)).join('')}</div><div class="ic-controls"><button type="button" class="ic-prev" aria-label="${en?'Previous Insight':'Předchozí Příklep'}">←</button><div class="ic-tabs" aria-label="${en?'Choose an Insight':'Vybrat Příklep'}">${items.map((item,index)=>`<button type="button" data-slide="${index}" aria-label="${esc((index+1)+'. '+(item.player||item.team)+' · '+insightStat(item,lang))}"><span>${String(index+1).padStart(2,'0')}</span><b>${esc(item.player||item.team)}</b></button>`).join('')}</div><button type="button" class="ic-next" aria-label="${en?'Next Insight':'Další Příklep'}">→</button><span class="ic-status" aria-live="polite" aria-atomic="true"></span></div>`;
  section.hidden=false;let active=0;
  const track=section.querySelector('.ic-track'),tabs=[...section.querySelectorAll('[data-slide]')];
  const update=index=>{active=index;tabs.forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));section.querySelector('.ic-status').textContent=`${index+1} / ${items.length}`;};
  const move=index=>{index=(index+items.length)%items.length;update(index);track.scrollTo({left:index*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  const listeners=signal?{signal}:undefined;
  section.querySelector('.ic-prev').addEventListener('click',()=>move(active-1),listeners);section.querySelector('.ic-next').addEventListener('click',()=>move(active+1),listeners);
  tabs.forEach((button,i)=>button.addEventListener('click',()=>move(i),listeners));
  track.addEventListener('scroll',()=>update(Math.max(0,Math.min(items.length-1,Math.round(track.scrollLeft/track.clientWidth)))),listeners);
  track.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();move(event.key==='Home'?0:event.key==='End'?items.length-1:active+(event.key==='ArrowRight'?1:-1));}},listeners);
  update(0);if(items.length===1)section.querySelector('.ic-controls').hidden=true;
 }catch(error){if(error.name==='AbortError'||signal?.aborted||!section.isConnected){section.remove();return;}section.hidden=false;section.innerHTML=`<p class="notice">${en?'Highlights are temporarily unavailable.':'Příklepy se nyní nepodařilo načíst.'} <a href="${esc(allHref)}">${en?'Open Insights':'Otevřít Příklepy'} →</a></p>`;}
}
