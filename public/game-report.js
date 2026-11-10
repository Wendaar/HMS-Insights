import {createPlayerCard} from './player-card.js';
import { localizeReportNode, reportNames, reportLocale } from './game-report-i18n.js';
import {mergeReportPortraits} from './game-report-portraits.js';
import './game-report-extras.js';
import {sportingImage} from './game-report-media.js';
import { filterReportEvents,durationLabel } from './game-report-data.js';
import { rinkSvg,netSvg,unknownGoals,miniGoalMaps } from './game-report-graphics.js';
const {summary}=JSON.parse(document.getElementById('game-report-data').textContent);
document.addEventListener('report-portraits',event=>mergeReportPortraits(summary,event.detail));
const lang=document.documentElement.lang,names=reportNames(summary);
const localize=node=>localizeReportNode(node,lang,names);
for(const link of document.querySelectorAll('[data-report-lang]')){const url=new URL(location.href);url.searchParams.set('lang',link.dataset.reportLang);link.href=url.pathname+url.search+url.hash;}
const events=summary.timeline?.events??[],byId=new Map(events.map(e=>[e.id,e]));
const $=id=>document.getElementById(id),rail=$('event-rail'),dialog=$('event-dialog'),playerDialog=$('player-dialog');
const filters={team:'all',period:'all',type:'all'};
const known=value=>value!=null&&value!==''&&!/^(neznám|neuveden|unknown|n\/a)/i.test(String(value));
const teamName=id=>[summary.home,summary.away].find(t=>t.id.toLowerCase()===id?.toLowerCase())?.name;
const behavior=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
function refresh(){
  if(!rail)return;
  const visible=new Set(filterReportEvents(events,filters).map(e=>e.id));
  document.querySelectorAll('.rail-item').forEach(item=>{item.hidden=!visible.has(item.dataset.eventId);});
  let previousPeriod=null;
  document.querySelectorAll('.rail-item').forEach(item=>{item.classList.remove('period-start');if(!item.hidden){if(item.dataset.period!==previousPeriod)item.classList.add('period-start');previousPeriod=item.dataset.period;}});
  $('rail-count').textContent=`${visible.size} událostí`;$('rail-empty').hidden=visible.size>0;$('clear-zone-filter').hidden=!filters.zoneKind;
  const goals=filterReportEvents(events,{team:filters.team,period:filters.period,type:'goal'});
  for(const map of document.querySelectorAll('[data-map]')){
    const field=map.dataset.map;
    const subset=map.dataset.mapScorer?goals.filter(e=>e.teamId?.toLowerCase()===map.dataset.mapScorer.toLowerCase()):goals;
    map.querySelector('.map-content').innerHTML=(field==='shotZone'?rinkSvg(summary,subset,{uid:map.dataset.mapId}):netSvg(summary,subset,{uid:map.dataset.mapId}))+unknownGoals(summary,subset,field);
  }
  localize(document.querySelector('main'));
}
function playerButton(player){
  if(!/^[a-f0-9-]{36}$/i.test(player.id??'')){const name=document.createElement('span');name.textContent=player.name;return name;}
  const button=document.createElement('button');button.type='button';button.className='player-link';button.textContent=player.name;button.dataset.playerId=player.id??'';return button;
}
function row(list,label,value){
  if(!known(value)&&!(value instanceof Node))return;
  const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;
  if(value instanceof Node)dd.append(value);else dd.textContent=String(value);
  list.append(dt,dd);
}
function openEvent(id){
  const event=byId.get(id);if(!event||!dialog)return;
  $('event-detail-kicker').textContent=event.type==='goal'?'GÓL':event.type==='penalty'?'TREST':'ZÁKROK';
  const title=$('event-detail-title');title.replaceChildren();
  if(known(event.player.name))title.append(playerButton(event.player));else title.textContent=event.type==='goal'?'Gól':event.type==='penalty'?'Trest':'Zákrok';
  $('event-detail-context').textContent=[teamName(event.teamId),event.period?`${event.period}. část`:null,event.clock].filter(known).join(' · ');
  const content=$('event-detail-content');content.replaceChildren();
  if(event.type==='goal'){
    const mini=document.createElement('div');mini.innerHTML=miniGoalMaps(summary,event);content.append(mini);
  }
  const list=document.createElement('dl');
  if(!event.clock&&event.recordedAt)row(list,'Čas zápisu',new Intl.DateTimeFormat(reportLocale(lang),{timeZone:'Europe/Prague',dateStyle:'short',timeStyle:'medium'}).format(new Date(event.recordedAt)));
  if(event.type==='goal'){
    row(list,'Skóre po gólu',event.scoreAfter?`${event.scoreAfter.home}:${event.scoreAfter.away}`:null);
    const assists=event.assists.filter(p=>known(p.name));
    if(assists.length){const span=document.createElement('span');assists.forEach((p,i)=>{if(i)span.append(', ');span.append(playerButton(p));});row(list,'Asistence',span);}
    if(known(event.allowedBy?.name))row(list,'Brankář',playerButton(event.allowedBy));
    row(list,'Střela',event.details?.shotType?.name);
    row(list,'Provedení',event.details?.goalSubtype?.name);
    row(list,'Odkud',event.details?.shotZone?.label);
    row(list,'Kam',event.details?.netZone?.label);
    const m=event.situation?.manpower;
    row(list,'Početní situace',m?`${m.for} na ${m.against}`:event.situation?.label);
    if(event.situation?.source==='penalty-model'){
      const note=document.createElement('p');note.className='map-caption';note.textContent=event.situation.basis==='no-active-penalty'?'5 na 5 dle průběhu: v evidenci v tuto chvíli neběží trest.':'Početní situace doplněná podle průběhu trestů.';content.append(note);
    }
  }else if(event.type==='penalty'){
    row(list,'Délka trestu',event.penaltyMinutes>0?durationLabel(event.penaltyMinutes):null);
    row(list,'Typ trestu',event.penaltyDetails?.type?.name);row(list,'Přestupek',event.penaltyDetails?.subtype?.name);
  }
  content.append(list);
  const hash=`#event=${encodeURIComponent(id)}`;$('event-permalink').hidden=false;$('event-permalink').href=hash;history.replaceState(null,'',hash);
  localize(dialog);if(!dialog.open)dialog.showModal();
}
function openGoals(ids){
  const goals=ids.map(id=>byId.get(id)).filter(Boolean);
  if(goals.length===1){openEvent(goals[0].id);return;}
  if(!goals.length||!dialog)return;
  $('event-detail-kicker').textContent='VYBRANÉ GÓLY';$('event-detail-title').textContent=`${goals.length} góly`;$('event-detail-context').textContent='Vyberte gól pro detail';$('event-permalink').hidden=true;
  const list=document.createElement('div');list.className='goal-picker';
  for(const goal of goals){const b=document.createElement('button');b.type='button';b.dataset.eventId=goal.id;b.textContent=[goal.clock,goal.player.name,goal.scoreAfter?`${goal.scoreAfter.home}:${goal.scoreAfter.away}`:null].filter(known).join(' · ');list.append(b);}
  $('event-detail-content').replaceChildren(list);localize(dialog);if(!dialog.open)dialog.showModal();
}
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement)event.target.hidden=true;},true);
document.querySelectorAll('img').forEach(img=>{if(img.complete&&!img.naturalWidth)img.hidden=true;});
playerDialog?.classList.add('hms-player-card');
const openPlayer=playerDialog?createPlayerCard({dialog:playerDialog,title:$('player-card-title'),content:$('player-card-content'),lang,localize,
 knownPlayer:id=>[...summary.players,...summary.goalies,...events.flatMap(e=>[e.player,...(e.assists??[]),e.allowedBy].filter(Boolean))].find(p=>p.id?.toLowerCase()===id.toLowerCase()),
 loadCard:async id=>{const response=await fetch('/api/player-card?'+new URLSearchParams({gameId:summary.gameId,playerId:id}),{headers:{accept:'application/json'}});if(!response.ok)throw Error('unavailable');return response.json();}
}):()=>{};

document.addEventListener('click',event=>{
  const languageLink=event.target.closest('[data-report-lang]');if(languageLink){const url=new URL(location.href);url.searchParams.set('lang',languageLink.dataset.reportLang);languageLink.href=url.pathname+url.search+url.hash;return;}
  const strength=event.target.closest('button[data-strength]');if(strength){
    const goals=events.filter(e=>e.type==='goal'&&e.teamId?.toLowerCase()===strength.dataset.strengthTeam.toLowerCase()&&e.situation?.code===strength.dataset.strength);
    openGoals(goals.map(e=>e.id));return;
  }
  const player=event.target.closest('button[data-player-id]');if(player){openPlayer(player.dataset.playerId);return;}
  const goal=event.target.closest('button[data-event-id]');if(goal){openEvent(goal.dataset.eventId);return;}
  const mark=event.target.closest('[data-goal-ids]');if(mark){try{openGoals(JSON.parse(mark.dataset.goalIds));}catch{}}
});
document.addEventListener('keydown',event=>{const mark=event.target.closest('[data-goal-ids]');if(mark&&['Enter',' '].includes(event.key)){event.preventDefault();try{openGoals(JSON.parse(mark.dataset.goalIds));}catch{}}});
$('player-dialog-close')?.addEventListener('click',()=>playerDialog.close());

if(rail){
  for(const [id,key]of[['report-team','team'],['report-period','period'],['report-event-type','type']])$(id).addEventListener('change',e=>{filters[key]=e.target.value;refresh();rail.scrollLeft=0;});
  const scroll=direction=>rail.scrollBy({left:direction*Math.max(230,rail.clientWidth*.75),behavior:behavior()});
  $('rail-prev').addEventListener('click',()=>scroll(-1));$('rail-next').addEventListener('click',()=>scroll(1));
  rail.addEventListener('keydown',e=>{if(e.target===rail&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();scroll(e.key==='ArrowLeft'?-1:1);}});
  $('event-dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(location.hash.startsWith('#event='))history.replaceState(null,'',location.pathname+location.search);});
  $('clear-zone-filter').addEventListener('click',()=>{delete filters.zoneKind;delete filters.zoneCode;refresh();});
  const fromHash=()=>{if(location.hash.startsWith('#event=')){try{openEvent(decodeURIComponent(location.hash.slice(7)));}catch{}}else if(dialog.open)dialog.close();};
  window.addEventListener('hashchange',fromHash);refresh();fromHash();
}
