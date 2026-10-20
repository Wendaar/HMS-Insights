import { renderHero,renderSpotlight,renderMatchSidebar } from './game-report-showcase.js';
import { renderRosters } from "./game-report-roster.js";
import { renderInteractiveTimeline, renderGameMaps, renderSpecialTeams, reportCatalog } from "./game-report-interactive.js";
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);

export function renderGameReport(summary, { preview = false } = {}) {
  const s = summary;
  const timelineHtml = renderInteractiveTimeline(s);
  const data = JSON.stringify({ summary: s, catalog: reportCatalog }).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(s.home.name)} ${html(s.home.score)}:${html(s.away.score)} ${html(s.away.name)} | HMS Game Center</title><link rel="stylesheet" href="/game-report.css"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/game-report-premium.css"></head>
  <body><main><nav aria-label="Hlavní navigace"><a class="brand" href="/priklepy">HMS <span>GAME CENTER</span></a><a href="/priklepy">Příklepy ↗</a></nav>
  ${preview ? '<aside class="data-note">Lokální testovací náhled z veřejného zápisu HMS. Nejde o nový import do databáze.</aside>' : ""}
  ${renderHero(s)}<div class="report-layout"><div class="report-primary">${renderSpotlight(s)}
  <section aria-labelledby="timeline"><p class="eyebrow">PRŮBĚH ZÁPASU</p><h2 id="timeline">Časová osa zápasu</h2>${timelineHtml}</section>
  ${renderGameMaps(s)}${renderSpecialTeams(s)}
  <section aria-labelledby="moments"><p class="eyebrow">MOMENTY ZÁPASU</p><h2 id="moments">Příklepy <span class="count">${s.priklepy.length}</span></h2><div class="moments">${s.priklepy.map((p) => `<article><h3>${html(p.title)}</h3><p>${html(p.text)}</p></article>`).join("") || "<p>V tomto zápase zatím nejsou žádné Příklepy.</p>"}</div></section>
  ${renderRosters(s)}
  </div>${renderMatchSidebar(s)}</div><footer><p>Zdroj: HMS · Aktualizace dat: ${html(s.provenance.updatedAt ?? "neuvedena")}</p><p>Výsledek vychází z uloženého výsledku HMS. Statistiky a průběh vycházejí z evidovaných událostí a mohou být neúplné.</p><a href="/api/game-summary?gameId=${encodeURIComponent(s.gameId)}">Data zápasu (JSON)</a></footer></main><dialog id="player-dialog" aria-labelledby="player-card-title"><div class="event-dialog-head"><p class="eyebrow">HRÁČSKÁ KARTA</p><button type="button" id="player-dialog-close" aria-label="Zavřít kartu hráče">×</button></div><h2 id="player-card-title"></h2><div id="player-card-content" aria-live="polite"></div></dialog><script type="application/json" id="game-report-data">${data}</script><script type="module" src="/game-report.js"></script></body></html>`;
}
