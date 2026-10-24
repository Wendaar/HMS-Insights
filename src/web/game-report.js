import { renderHero,renderSpotlight,renderMatchSidebar } from './game-report-showcase.js';
import { reportLanguage, reportHtml, reportNames } from '../../public/game-report-i18n.js';
import { renderRosters } from "./game-report-roster.js";
import { renderInteractiveTimeline, renderGameMaps, renderSpecialTeams, reportCatalog } from "./game-report-interactive.js";
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);

export function renderGameReport(summary, { preview = false, lang: requestedLanguage } = {}) {
  const s = summary;
  const lang = reportLanguage(requestedLanguage, s);
  const timelineHtml = renderInteractiveTimeline(s, lang);
  const data = JSON.stringify({ summary: s, catalog: reportCatalog }).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return reportHtml(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(s.home.name)} ${html(s.home.score)}:${html(s.away.score)} ${html(s.away.name)} | HMS Game Center</title><link rel="stylesheet" href="/game-report.css"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/game-report-premium.css"></head>
  <body><main><nav aria-label="Hlavní navigace"><a class="brand" href="/priklepy">HMS <span>GAME CENTER</span></a><span class="report-nav-actions"><span class="language-switch" aria-label="Language"><a data-report-lang="cs" lang="cs" hreflang="cs" href="?lang=cs"${lang==='cs'?' aria-current="true"':''}>CZ</a><a data-report-lang="en" lang="en" hreflang="en" href="?lang=en"${lang==='en'?' aria-current="true"':''}>EN</a></span><a href="/priklepy">Příklepy ↗</a></span></nav>
  ${preview ? '<aside class="data-note">Lokální testovací náhled z veřejného zápisu HMS. Nejde o nový import do databáze.</aside>' : ""}
  ${renderHero(s, lang)}<div class="report-layout"><div class="report-primary"><div id="broadcast-mobile-slot"></div><section id="game-stars" class="game-stars" hidden aria-labelledby="game-stars-heading"><div class="section-heading"><div><p class="eyebrow">VYBRÁNO V HMS</p><h2 id="game-stars-heading">Hvězdy zápasu</h2></div><div class="rail-controls"><button type="button" id="stars-prev" aria-label="Předchozí hvězdy">←</button><button type="button" id="stars-next" aria-label="Další hvězdy">→</button></div></div><div id="stars-rail" class="stars-rail" tabindex="0" role="region" aria-label="Hvězdy zápasu"><div id="stars-cards" class="stars-cards"></div></div></section>${renderSpotlight(s)}
  <section aria-labelledby="timeline"><p class="eyebrow">PRŮBĚH ZÁPASU</p><h2 id="timeline">Časová osa zápasu</h2>${timelineHtml}</section>
  ${renderGameMaps(s, lang)}${renderSpecialTeams(s, lang)}
  <section aria-labelledby="moments"><p class="eyebrow">MOMENTY ZÁPASU</p><h2 id="moments">Příklepy <span class="count">${s.priklepy.length}</span></h2><div class="moments">${s.priklepy.map((p) => `<article><h3>${html(p.title)}</h3><p>${html(p.text)}</p></article>`).join("") || "<p>V tomto zápase zatím nejsou žádné Příklepy.</p>"}</div></section>
  ${renderRosters(s, lang)}
  </div>${renderMatchSidebar(s, lang)}</div><footer><p>Zdroj: HMS · Aktualizace dat: ${html(s.provenance.updatedAt ?? "neuvedena")}</p><p>Výsledek vychází z uloženého výsledku HMS. Statistiky a průběh vycházejí z evidovaných událostí a mohou být neúplné.</p><a href="/api/game-summary?gameId=${encodeURIComponent(s.gameId)}">Data zápasu (JSON)</a></footer></main><dialog id="player-dialog" aria-labelledby="player-card-title"><div class="event-dialog-head"><p class="eyebrow">HRÁČSKÁ KARTA</p><button type="button" id="player-dialog-close" aria-label="Zavřít kartu hráče">×</button></div><h2 id="player-card-title"></h2><div id="player-card-content" aria-live="polite"></div></dialog><script type="application/json" id="game-report-data">${data}</script><script type="module" src="/game-report.js"></script></body></html>`, lang, reportNames(s));
}
