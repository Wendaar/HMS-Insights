import { SHOT_ZONES, NET_ZONES } from "../domain/goal-details.js";
import { goalZoneCounts, situationCounts, durationLabel } from "../../public/game-report-data.js";

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const html = escapeHtml;
export const reportCatalog = { shotZone: SHOT_ZONES, netZone: NET_ZONES };

export function renderInteractiveTimeline(summary) {
  const timeline = summary.timeline;
  if (!timeline?.available) return "<p>Průběh tohoto zápasu ještě není uložený. Doplní ho nové načtení zápisu z HMS.</p>";
  const team = (id) => id?.toLowerCase() === summary.home.id.toLowerCase() ? summary.home.name : id?.toLowerCase() === summary.away.id.toLowerCase() ? summary.away.name : "Tým neuveden";
  const events = timeline.events.filter((event) => event.type !== "save");
  const periods = [...new Set(timeline.events.map((event) => event.period))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
  return `${timeline.coverage !== "matches-result" ? '<p class="data-note">Evidované góly nepotvrzují celý výsledek. Průběžné skóre proto neuvádíme.</p>' : ""}
    ${!timeline.ordered ? '<p class="data-note">U některých gólů nelze určit přesné pořadí. Průběžné skóre neuvádíme; události bez úplného času jsou na konci.</p>' : ""}
    ${timeline.ordered && timeline.unplacedEvents ? '<p class="data-note">Některé události nemají úplný čas nebo část zápasu a jsou uvedené na konci.</p>' : ""}
    ${events.length ? "" : "<p>V načteném zápisu nejsou góly ani tresty.</p>"}<div class="timeline-toolbar"><div class="timeline-filters">
    <label>Tým<select id="report-team"><option value="all">Oba týmy</option><option value="${html(summary.home.id)}">${html(summary.home.name)}</option><option value="${html(summary.away.id)}">${html(summary.away.name)}</option></select></label>
    <label>Část zápasu<select id="report-period"><option value="all">Celý zápas</option value="unknown">Část neuvedena</option>${periods.filter(Boolean).map((period) => `<option value="${period}">${period}. část</option>`).join("")}</select></label>
    <label>Události<select id="report-event-type"><option value="all">Góly a tresty</option value="goal">Góly</option><option value="penalty">Tresty</option><option value="save">Zákroky</option></select></label></div>
    <div class="rail-controls"><button type="button" id="rail-prev" aria-label="Posunout události doleva">←</button><button type="button" id="rail-next" aria-label="Posunout události doprava">→</button></div></div>
    ${timeline.periodScores.length ? `<div class="period-scores" aria-label="Góly podle evidovaných částí">${timeline.periodScores.map((p) => `<div><small>${p.period}. část</small><strong>${p.home}:${p.away}</strong></div>`).join("")}</div>` : ""}
    <div class="rail-hint"><span>Posouvejte vodorovně a klikněte na událost.</span><span id="rail-count" role="status">${events.length} událostí</span></div>
    <div class="event-rail" id="event-rail" tabindex="0" role="region" aria-label="Vodorovná časová osa zápasu"><ol class="rail-list">${timeline.events.map((event) => `<li class="rail-item" data-event-id="${html(event.id)}"${event.type === "save" ? " hidden" : ""}><button class="event-marker ${event.type}" type="button" data-event-id="${html(event.id)}" aria-label="${html(`${event.clock ?? "Čas neuveden"} · ${event.type === "goal" ? "Gól" : event.type === "penalty" ? "Trest" : "Zákrok"} · ${event.player.name ?? "Hráč neuveden"}`)}" aria-haspopup="dialog"><span class="marker-clock">${html(event.clock ?? "Bez času")}<small>${event.period ? `${event.period}. část` : "Část neuvedena"}</small></span><span class="marker-dot" aria-hidden="true">${event.type === "goal" ? "G" : event.type === "penalty" ? "T" : "Z"}</span><span class="marker-kind">${event.type === "goal" ? "GÓL" : event.type === "penalty" ? "TREST" : "ZÁKROK"}${event.situation?.code === "PP" ? " · PP" : event.situation?.code === "SH" ? " · SH" : ""}</span>${event.situation?.source === "penalty-model" ? '<span class="estimate">Odhad početní výhody</span>' : ""}<strong class="marker-player">${html(event.player.name ?? "Hráč neuveden")}</strong><span class="marker-team">${html(team(event.teamId))}</span><span class="marker-result">${event.scoreAfter ? `${event.scoreAfter.home}:${event.scoreAfter.away}` : event.type === "penalty" ? html(durationLabel(event.penaltyMinutes)) : "Detail →"}</span></button></li>`).join("")}</ol></div>
    <p id="rail-empty" class="empty-state" hidden>Tomuto výběru neodpovídá žádná událost.</p><button id="clear-zone-filter" type="button" class="subtle-button" hidden>Zrušit výběr zóny</button>
    <dialog id="event-dialog" aria-labelledby="event-detail-title"><div class="event-dialog-head"><p id="event-detail-kicker" class="eyebrow"></p><button id="event-dialog-close" type="button" aria-label="Zavřít detail události">×</button></div><h2 id="event-detail-title"></h2><p id="event-detail-context"></p><div id="event-detail-content"></div><p><a id="event-permalink">Odkaz na tuto událost</a></p></dialog>
    <noscript><details><summary>Textový průběh zápasu</summary><ol>${events.map((event) => `<li>${html(event.clock ?? "Čas neuveden")} · ${html(event.player.name)} · ${event.type === "goal" ? "Gól" : "Trest"}</li>`).join("")}</ol></details></noscript>`;
}

function zoneMap(events, field, title) {
  const catalog = reportCatalog[field];
  const isRink = field === "shotZone";
  const counts = goalZoneCounts(events, field, catalog);
  const max = Math.max(1, ...Object.values(counts.counts));
  const height = isRink ? 470 : 300;
  const rowHeight = isRink ? 82 : 76;
  const cells = catalog.map((zone, index) => {
    const x = 22 + (index % 3) * 96;
    const y = 30 + Math.floor(index / 3) * rowHeight;
    const count = counts.counts[zone.code];
    const heat = count ? Math.ceil(count / max * 5) : 0;
    const words = zone.label.split(" ");
    const midpoint = Math.ceil(words.length / 2);
    const lines = words.length > 2 ? [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")] : [zone.label];
    return `<g class="map-zone heat-${heat}" data-map-kind="${field}" data-zone="${zone.code}" role="button" tabindex="0" aria-pressed="false" aria-label="${html(zone.label)}: ${count} gólů"><title>${html(zone.label)}: ${count} gólů</title><rect x="${x}" y="${y}" width="92" height="${rowHeight - 5}" rx="9"/><text x="${x + 46}" y="${y + 19}" text-anchor="middle" class="zone-label">${lines.map((line, i) => `<tspan x="${x + 46}" dy="${i ? 12 : 0}">${html(line)}</tspan>`).join("")}</text><text x="${x + 46}" y="${y + rowHeight - 17}" text-anchor="middle" class="zone-count">${count}</text></g>`;
  }).join("");
  const outline = isRink
    ? '<rect class="rink-outline" x="14" y="10" width="302" height="444" rx="62"/><path class="rink-lines" d="M16 195H314 M16 277H314 M16 359H314"/><circle class="rink-lines" cx="165" cy="275" r="37"/><path class="rink-lines" d="M140 13V22H190V13"/>'
    : '<rect class="rink-outline net-outline" x="14" y="18" width="302" height="240" rx="34"/><path class="rink-lines" d="M20 258H310"/>';
  return `<article class="zone-map" data-map="${field}"><div class="map-title"><h3>${title}</h3><span class="map-coverage">${counts.mapped}/${counts.total}</span></div><p class="map-caption">${isRink ? "Zóny kluziště podle zápisu HMS" : "Zóny branky z pohledu střelce"}</p><svg class="zone-svg ${isRink ? "rink-map" : "net-map"}" viewBox="0 0 330 ${height}" role="group" aria-label="${title}">${outline}${cells}</svg><button class="unknown-zone" type="button" data-map-kind="${field}" data-zone="unknown" aria-pressed="false">Neuvedeno / nerozpoznáno <strong class="unknown-count">${counts.unknown}</strong></button><p class="map-footnote">Kliknutím na zónu vyberete příslušné góly. Nevyplněné údaje jsou mimo mapu.</p></article>`;
}

export function renderGameMaps(summary) {
  const events = summary.timeline?.events ?? [];
  return `<section aria-labelledby="goal-maps"><p class="eyebrow">ODKUD A KAM</p><h2 id="goal-maps">Mapy gólů</h2><p class="section-copy">Zónové počty gólů. Nejde o přesné souřadnice ani mapu všech střel.</p><div class="goal-maps">${zoneMap(events, "shotZone", "Odkud padly góly")}${zoneMap(events, "netZone", "Kam padly góly")}</div></section>`;
}

export function renderSpecialTeams(summary) {
  const counts = situationCounts(summary.timeline?.events ?? []);
  return `<section aria-labelledby="special-teams"><p class="eyebrow">POČETNÍ VÝHODA</p><h2 id="special-teams">Přesilovky a oslabení</h2><div class="special-grid"><article><small>PP góly · zapsané v HMS</small><strong id="pp-recorded">${counts.recorded.PP}</strong></article><article><small>SH góly · zapsané v HMS</small><strong id="sh-recorded">${counts.recorded.SH}</strong></article><article><small>PP / SH · odhad z trestů</small><strong id="strength-estimated">${counts.estimated.PP} / ${counts.estimated.SH}</strong></article><article><small>Situace neurčena</small><strong id="strength-unknown">${counts.unknown}</strong></article></div><p class="section-copy">Zapsané označení gólu má přednost. Odhad podporuje jednoduchý případ jednoho trestu do dvou minut, který při PP gólu končí. Pokud typ trestu chybí, krátký trest považujeme za menší a tento předpoklad uvádíme v detailu. Neověřuje odvolání brankáře; složité nebo neúplné situace zůstávají neurčené. Úspěšnost PP/PK zatím nepočítáme. Nula zapsaných PP gólů při chybějících typech neznamená nulu skutečných PP gólů.</p></section>`;
}
