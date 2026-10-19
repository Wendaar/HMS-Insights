import { renderInteractiveTimeline, renderGameMaps, renderSpecialTeams, reportCatalog } from "./game-report-interactive.js";
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);

export function renderGameReport(summary, { preview = false } = {}) {
  const s = summary;
  const teamName = (id) => id?.toLowerCase() === s.home.id.toLowerCase() ? s.home.name : id?.toLowerCase() === s.away.id.toLowerCase() ? s.away.name : "Neuvedený tým";
  const playerRows = s.players.map((p) => `<tr><th scope="row">${html(p.name)}<small>${html(teamName(p.teamId))}</small></th><td>${html(p.goals)}</td><td>${html(p.assists)}</td><td><strong>${html(p.points)}</strong></td><td>${html(p.penaltyMinutes)}</td></tr>`).join("");
  const timelineHtml = renderInteractiveTimeline(s);
  const data = JSON.stringify({ summary: s, catalog: reportCatalog }).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(s.home.name)} ${html(s.home.score)}:${html(s.away.score)} ${html(s.away.name)} | HMS Game Center</title><link rel="stylesheet" href="/game-report.css"><link rel="icon" href="/favicon.svg"></head>
  <body><main><nav aria-label="Hlavní navigace"><a class="brand" href="/priklepy">HMS <span>GAME CENTER</span></a><a href="/priklepy">Příklepy ↗</a><a href="/archiv">Archiv</a></nav>
  ${preview ? '<aside class="data-note">Lokální testovací náhled z veřejného zápisu HMS. Nejde o nový import do databáze.</aside>' : ""}
  <header><p class="eyebrow">GAME REPORT · ${s.status === "FINISHED" ? "DOHRÁNO" : html(s.status)}</p><p>${html([s.competition, s.season, s.group, s.phase].filter(Boolean).join(" · "))}</p>
  <div class="scoreboard"><h1>${html(s.home.name)}<small>DOMÁCÍ</small></h1><strong class="score" aria-label="Výsledek ${html(s.home.score)} ku ${html(s.away.score)}">${html(s.home.score)}<span>:</span>${html(s.away.score)}</strong><h2>${html(s.away.name)}<small>HOSTÉ</small></h2></div>
  <p><time datetime="${html(s.playedOn)}">${html(s.playedOn)}</time> · ${html(s.venue ?? "Stadion neuveden")}</p></header>
  <section aria-labelledby="timeline"><p class="eyebrow">PRŮBĚH ZÁPASU</p><h2 id="timeline">Časová osa zápasu</h2>${timelineHtml}</section>
  ${renderGameMaps(s)}${renderSpecialTeams(s)}
  <section aria-labelledby="moments"><p class="eyebrow">MOMENTY ZÁPASU</p><h2 id="moments">Příklepy <span class="count">${s.priklepy.length}</span></h2><div class="moments">${s.priklepy.map((p) => `<article><h3>${html(p.title)}</h3><p>${html(p.text)}</p></article>`).join("") || "<p>V tomto zápase zatím nejsou žádné Příklepy.</p>"}</div></section>
  <section aria-labelledby="players"><p class="eyebrow">INDIVIDUÁLNÍ VÝKONY</p><h2 id="players">Kanadské bodování</h2>${s.players.length ? `<div class="table-scroll"><table><caption>Hráči podle bodů · G góly · A asistence · B body · TM trestné minuty</caption><thead><tr><th scope="col">Hráč / tým</th><th scope="col">G</th><th scope="col">A</th><th scope="col">B</th><th scope="col">TM</th></tr></thead><tbody>${playerRows}</tbody></table></div>` : "<p>Statistiky hráčů nejsou k dispozici.</p>"}</section>
  <section aria-labelledby="goalies"><h2 id="goalies">Brankáři</h2><div class="moments">${s.goalies.map((p) => `<article><h3>${html(p.name)}</h3><p>${html(teamName(p.teamId))}</p><p><strong>${html(p.saves)}</strong> zákroků · ${html(p.goalsAgainst)} evidovaných inkasovaných gólů</p></article>`).join("") || "<p>Statistiky brankářů nejsou k dispozici.</p>"}</div></section>
  <footer><p>Zdroj: HMS · Aktualizace dat: ${html(s.provenance.updatedAt ?? "neuvedena")}</p><p>Výsledek vychází z uloženého výsledku HMS. Statistiky a průběh vycházejí z evidovaných událostí a mohou být neúplné.</p><a href="/api/game-summary?gameId=${encodeURIComponent(s.gameId)}">Data zápasu (JSON)</a></footer></main><script type="application/json" id="game-report-data">${data}</script><script type="module" src="/game-report.js"></script></body></html>`;
}
