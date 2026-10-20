import { SHOT_ZONES,NET_ZONES } from '../domain/goal-details.js';
import { escape as html } from '../../public/game-report-graphics.js';
import { situationCounts,durationLabel } from '../../public/game-report-data.js';
export {renderGameMaps} from './game-report-maps.js';
export const escapeHtml=html;
export const reportCatalog={shotZone:SHOT_ZONES,netZone:NET_ZONES};
const known=value=>value&&!/^(neznám|neuveden|unknown)/i.test(value);
export function renderInteractiveTimeline(summary){
  const timeline=summary.timeline;
  if(!timeline?.available)return '<p>Průběh zápasu bude dostupný po načtení zápisu.</p>';
  const events=timeline.events.filter(e=>e.type!=='save');
  const team=id=>[summary.home,summary.away].find(t=>t.id.toLowerCase()===id?.toLowerCase())?.name;
  const periods=[...new Set(timeline.events.map(e=>e.period).filter(Boolean))].sort((a,b)=>a-b);
  return `${timeline.coverage!=='matches-result'?'<p class="data-note">Průběžné skóre není k dispozici: evidované góly nepotvrzují celý výsledek.</p>':''}
  ${!timeline.ordered?'<p class="data-note">U některých gólů nelze určit přesné pořadí. Průběžné skóre neuvádíme.</p>':''}
  ${timeline.ordered&&timeline.unplacedEvents?'<p class="data-note">Další události bez úplného času jsou na konci osy.</p>':''}
  ${events.length?'':'<p>V načteném zápisu nejsou góly ani tresty.</p>'}
  <div class="timeline-toolbar"><div class="timeline-filters"><label for="report-team">Tým</label><select id="report-team"><option value="all">Oba týmy</option>${[summary.home,summary.away].map(t=>`<option value="${html(t.id)}">${html(t.name)}</option>`).join('')}</select><label class="sr-only" for="report-period">Část zápasu</label><select id="report-period"><option value="all">Celý zápas</option>${periods.map(p=>`<option value="${p}">${p}. část</option>`).join('')}${timeline.events.some(e=>!e.period)?'<option value="unknown">Další události</option>':''}</select><label class="sr-only" for="report-event-type">Události</label><select id="report-event-type"><option value="all">Góly a tresty</option><option value="goal">Góly</option><option value="penalty">Tresty</option><option value="save">Zákroky</option></select></div><div class="rail-controls"><button type="button" id="rail-prev" aria-label="Posunout události doleva">←</button><button type="button" id="rail-next" aria-label="Posunout události doprava">→</button></div></div>
  ${timeline.periodScores.length?`<div class="period-scores">${timeline.periodScores.map(p=>`<div><small>${p.period}. část</small><strong>${p.home}:${p.away}</strong></div>`).join('')}</div>`:''}
  <div class="rail-hint"><span>Průběh zápasu →</span><span id="rail-count" role="status">${events.length} událostí</span></div><div id="event-rail" class="event-rail" tabindex="0" role="region" aria-label="Vodorovná časová osa zápasu"><ol class="rail-list">${timeline.events.map(e=>{
    const name=known(e.player.name)?e.player.name:null;
    const title=[e.clock,e.type==='goal'?'Gól':e.type==='penalty'?'Trest':'Zákrok',name].filter(Boolean).join(' · ');
    const strength=e.situation?.manpower?`${e.situation.manpower.for} na ${e.situation.manpower.against}`:e.situation?.code==='PP'?'PP':e.situation?.code==='SH'?'SH':'';
    return `<li class="rail-item" data-event-id="${html(e.id)}"${e.type==='save'?' hidden':''}><article class="event-card ${e.type}"><button class="event-marker event-open ${e.type}" data-event-id="${html(e.id)}" type="button" aria-label="${html(title)}" aria-haspopup="dialog"><span class="sr-only">Detail události</span></button><span class="marker-clock">${html(e.clock??'')}${e.period?`<small>${e.period}. část</small>`:''}</span><span class="marker-dot" aria-hidden="true">${e.type==='goal'?'G':e.type==='penalty'?'T':'Z'}</span><span class="marker-kind">${e.type==='goal'?'GÓL':e.type==='penalty'?'TREST':'ZÁKROK'}${strength?` <span class="strength-pill" title="${e.situation.source==='hms'?'Zápis HMS':'Dopočteno z průběhu trestů'}">${strength}</span>`:''}</span>${name?`<button type="button" class="player-link marker-player" data-player-id="${html(e.player.id??'')}">${html(name)}</button>`:''}${team(e.teamId)?`<span class="marker-team">${html(team(e.teamId))}</span>`:''}<span class="marker-result">${e.scoreAfter?`${e.scoreAfter.home}:${e.scoreAfter.away}`:e.type==='penalty'&&e.penaltyMinutes!=null?durationLabel(e.penaltyMinutes):''}</span></article></li>`;
  }).join('')}</ol></div><p id="rail-empty" class="empty-state" hidden>Tomuto výběru neodpovídá žádná událost.</p><button id="clear-zone-filter" type="button" hidden>Zrušit výběr zóny</button>
  <dialog id="event-dialog" aria-labelledby="event-detail-title"><div class="event-dialog-head"><p class="eyebrow" id="event-detail-kicker"></p><button id="event-dialog-close" type="button" aria-label="Zavřít detail události">×</button></div><h2 id="event-detail-title"></h2><p id="event-detail-context"></p><div id="event-detail-content"></div><p><a id="event-permalink">Odkaz na událost ↗</a></p></dialog><noscript><details><summary>Textový průběh zápasu</summary><ol>${events.map(e=>`<li>${html([e.clock,e.type==='goal'?'Gól':'Trest',known(e.player.name)?e.player.name:null].filter(Boolean).join(' · '))}</li>`).join('')}</ol></details></noscript>`;
}
export function renderSpecialTeams(summary){
  const c=situationCounts(summary.timeline?.events??[]);
  return `<section aria-labelledby="special-teams"><div class="section-heading"><div><p class="eyebrow">POČETNÍ SITUACE PŘI GÓLECH</p><h2 id="special-teams">Přesilovky a oslabení</h2></div></div><div class="special-grid"><article><small>Vyrovnaný počet hráčů</small><strong id="strength-ev">${c.recorded.EV+c.estimated.EV}</strong></article><article><small>Góly v přesilovce</small><strong id="strength-pp">${c.recorded.PP+c.estimated.PP}</strong></article><article><small>Góly v oslabení</small><strong id="strength-sh">${c.recorded.SH+c.estimated.SH}</strong></article></div><p class="map-caption">Zápis HMS má přednost. Chybějící situaci doplňujeme podle běžících trestů; bez trestu předpokládáme 5 na 5.</p></section>`;
}
