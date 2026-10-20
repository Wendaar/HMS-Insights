import { escape as html } from '../../public/game-report-graphics.js';
const percent = (value) => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;

export function renderFaceoffs(summary) {
  const f = summary.faceoffs;
  if(!f?.available)return "";
  return `<section aria-labelledby="faceoffs"><p class="eyebrow">SOUBOJE NA BODU</p><h2 id="faceoffs">Vhazování</h2>${f?.available
    ? `<div class="faceoff-comparison">${[[summary.home, f.homeWins, f.homePercentage], [summary.away, f.awayWins, f.awayPercentage]].map(([team, wins, efficiency]) => `<article><h3>${html(team.name)}</h3><strong class="stat-percentage">${percent(efficiency)}</strong><p>${wins} vyhraných vhazování</p></article>`).join('')}</div><p class="section-copy">${f.total} evidovaných vhazování celkem${f.unattributed ? ` · ${f.unattributed} bez určeného vítěze; procenta nelze určit` : ''}. ${f.source === 'recorded-events' ? 'Spočítáno z evidovaných událostí.' : 'Součty ze zápisu HMS.'}</p>`
    : '<p class="section-copy">Údaje o vhazování ještě nejsou uložené. Doplní je nové načtení zápasu z HMS.</p>'}</section>`;
}

export function renderGoalies(summary) {
  const team = (id) => [summary.home, summary.away].find((item) => item.id.toLowerCase() === id?.toLowerCase())?.name ?? 'Tým neuveden';
  return `<section aria-labelledby="goalies"><h2 id="goalies">Brankáři</h2><div class="moments">${summary.goalies.map((p) => `<article><h3>${html(p.name)}</h3><p>${html(team(p.teamId))}</p><strong class="stat-percentage">${percent(p.savePercentage)}</strong><small>Úspěšnost zákroků · z evidovaných událostí</small><p><strong>${html(p.saves ?? '—')}</strong> zákroků · ${html(p.goalsAgainst ?? '—')} evidovaných inkasovaných gólů</p><p>${p.shotsAgainst === null || p.shotsAgainst === undefined ? 'Počet střel na brankáře nelze určit.' : `${p.shotsAgainst} evidovaných střel na brankáře`}</p></article>`).join('') || '<p>Statistiky brankářů nejsou k dispozici.</p>'}</div><p class="section-copy">Úspěšnost = zákroky / (zákroky + inkasované góly). Počítáme z událostí připsaných konkrétnímu brankáři; neúplný zápis může údaj ovlivnit. Při nulovém počtu střel procento neuvádíme.</p></section>`;
}
