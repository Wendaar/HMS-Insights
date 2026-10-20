import { portrait,teamLogo } from './game-report-showcase.js';
import { escape as html,teamLegend } from '../../public/game-report-graphics.js';
export function renderRosters(summary) {
  return `<section aria-labelledby="players"><div class="section-heading"><div><p class="eyebrow">HRÁČI ZÁPASU</p><h2 id="players">Kanadské bodování</h2></div><p class="section-meta">Klikněte na hráče pro statistiky v soutěži</p></div><div class="roster-grid">${[summary.home,summary.away].map(team=>{
    const players=summary.players.filter(p=>p.teamId?.toLowerCase()===team.id.toLowerCase());
    return `<article class="roster-card"><h3>${teamLogo(team)}${html(team.name)}</h3><div class="roster-counts" data-roster-count-team="${html(team.id)}" hidden></div><div class="table-scroll"><table><caption class="sr-only">${html(team.name)} · G góly · A asistence · B body · TM trestné minuty</caption><thead><tr><th scope="col">Hráč</th><th scope="col">G</th><th scope="col">A</th><th scope="col">B</th><th scope="col">TM</th></tr></thead><tbody>${players.map(p=>`<tr${p.points?'':' class="quiet-row"'}><th scope="row"><button class="player-link" type="button" data-player-id="${html(p.id)}">${portrait(p)}<span>${html(p.name)}</span></button></th><td class="goals-cell">${p.goals}</td><td>${p.assists}</td><td><strong>${p.points}</strong></td><td>${new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:2}).format(p.penaltyMinutes)}</td></tr>`).join('')}</tbody></table></div></article>`;
  }).join('')}</div></section>`;
}
