import { portrait,teamLogo } from './game-report-showcase.js';
import { rinkSvg,netSvg,unknownGoals,teamLegend,escape as html } from '../../public/game-report-graphics.js';
const percent = value => value == null ? '' : `${new Intl.NumberFormat('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} %`;
export function keeperSummary(summary,teamId) {
  return summary.goalies.filter(p=>p.teamId?.toLowerCase()===teamId.toLowerCase()).map(p=>`<div class="keeper-summary"><button type="button" class="player-link" data-player-id="${html(p.id)}">${portrait(p)}<span>${html(p.name)}</span></button><div class="keeper-numbers">${p.savePercentage!=null?`<strong>${percent(p.savePercentage)}<small>Úspěšnost zákroků</small></strong>`:''}${p.saves!=null?`<span>${p.saves}<small>Zákroky</small></span>`:''}${p.goalsAgainst!=null?`<span>${p.goalsAgainst}<small>Inkasované góly</small></span>`:''}</div></div>`).join('');
}
export function renderGameMaps(summary) {
  const events=summary.timeline?.events??[];
  const nets=[[summary.home,summary.away,'home-net'],[summary.away,summary.home,'away-net']].map(([defender,scorer,id])=>{
    const goals=events.filter(e=>e.type==='goal'&&e.teamId?.toLowerCase()===scorer.id.toLowerCase());
    return `<article class="map-card net-card" data-map="netZone" data-map-scorer="${html(scorer.id)}" data-map-id="${id}"><div class="map-card-heading"><div><p class="eyebrow">${id==='home-net'?'DOMÁCÍ BRANKA':'BRANKA HOSTŮ'}</p><h3>${teamLogo(defender)}${html(defender.name)}</h3></div></div><div class="map-content">${netSvg(summary,goals,{uid:id})}${unknownGoals(summary,goals,'netZone')}</div>${keeperSummary(summary,defender.id)}</article>`;
  }).join('');
  return `<section aria-labelledby="goal-maps" class="goals-section"><div class="section-heading"><div><p class="eyebrow">MAPA ZÁPASU</p><h2 id="goal-maps">Odkud padly góly</h2></div>${teamLegend(summary)}</div><article class="map-card rink-card" data-map="shotZone" data-map-id="shot-rink"><div class="map-content">${rinkSvg(summary,events,{uid:'shot-rink'})}${unknownGoals(summary,events,'shotZone')}</div><p class="map-caption">Čísla označují pořadí gólů, × počet sloučených gólů. Značky jsou rozmístěné uvnitř zón podle zápisu.</p></article></section><section aria-labelledby="goalies"><div class="section-heading"><div><p class="eyebrow">BRANKÁŘI A UMÍSTĚNÍ GÓLŮ</p><h2 id="goalies">Kam padly góly</h2></div></div><div class="goal-maps">${nets}</div><p class="map-caption">Pohled na branku od střelce. Úspěšnost brankářů vychází z evidovaných zákroků a inkasovaných gólů.</p></section>`;
}
