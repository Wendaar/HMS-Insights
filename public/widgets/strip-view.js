import {gameReportNavigation} from '../games/navigation.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={report:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/>',video:'<path d="m9 5 11 7-11 7z"/>',photos:'<path d="M3 7h5l2-3h4l2 3h5v13H3z"/><circle cx="12" cy="13" r="4"/>'};
export function stripActions(game,lang='cs'){
 const en=lang==='en',actions=[];
 if(game.live||game.status==='FINISHED'){
  if(game.reportUrl)actions.push({type:'report',label:'Game Report',href:gameReportNavigation(game.id,lang,true).href});
  else if(game.detailUrl)actions.push({type:'report',label:en?'Game detail (HMS)':'Detail zápasu (HMS)',href:game.detailUrl});
 }
 if(game.media?.youtubeUrl)actions.push({type:'video',label:en?'Video':'Přenos / video',href:game.media.youtubeUrl});
 if(game.media?.albumUrl)actions.push({type:'photos',label:en?'Photos':'Fotografie',href:game.media.albumUrl});
 return actions;
}
export function stripDateMarkup(date,lang='cs'){
 const d=new Date(date+'T12:00:00Z'),locale=lang==='en'?'en-GB':'cs-CZ';
 const format=options=>new Intl.DateTimeFormat(locale,{...options,timeZone:'UTC'}).format(d);
 return `<div class="strip-date"><time datetime="${esc(date)}" aria-label="${esc(format({dateStyle:'full'}))}"><small>${esc(format({weekday:'short'}))}</small><b>${esc(format({day:'numeric'}))}</b><span>${esc(format({month:'short'}))}</span></time></div>`;
}
export function stripCardMarkup(game,instance,lang='cs'){
 const en=lang==='en',actions=stripActions(game,lang),names=[game.home.name,game.away.name].filter(Boolean).join(' – ');
 const status=({FINISHED:en?'Final':'Konec',RUNNING:en?'In progress':'Probíhá','NOT PLAYED':en?'Scheduled':'Plánováno',SCHEDULED:en?'Scheduled':'Plánováno',CANCELLED:en?'Cancelled':'Zrušeno',POSTPONED:en?'Postponed':'Odloženo'})[game.status]??(game.live?(en?'In progress':'Probíhá'):(en?'Status unavailable':'Stav není dostupný'));
 const team=t=>`<div class="strip-team">${instance.display.showTeamLogo&&t.logoUrl?`<img src="${esc(t.logoUrl)}" alt="" loading="lazy">`:''}<strong title="${esc(t.name)}">${esc(t.shortName??t.name??(en?'Team to be announced':'Tým bude upřesněn'))}</strong>${t.rank!=null?`<small title="${esc(t.rankGroup)}" aria-label="${esc(t.rank+'. '+(t.rankGroup??''))}">${t.rank}.</small>`:''}${t.score!=null?`<b>${t.score}</b>`:''}</div>`;
 const overlayId='strip-'+instance.widgetInstanceId+'-'+game.id;
 return `<article class="strip-card" aria-label="${esc(names)}"><div class="strip-meta"><span>${esc(status)}</span>${game.time?`<time datetime="${esc(game.date+'T'+game.time)}">${esc(game.time)}</time>`:''}</div>${team(game.home)}${team(game.away)}${actions.length?`<button type="button" class="strip-toggle" aria-label="${esc((en?'Game links: ':'Odkazy k zápasu: ')+names)}" aria-expanded="false" aria-controls="${esc(overlayId)}"></button><nav class="strip-overlay" id="${esc(overlayId)}" aria-label="${en?'Game links':'Odkazy k zápasu'}" hidden>${actions.map(a=>`<a href="${esc(a.href)}" title="${esc(a.label)}" aria-label="${esc(a.label)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">${icons[a.type]}</svg></a>`).join('')}</nav>`:''}</article>`;
}
