const labels = {
  BIG_WIN: "Velká výhra",
  EARLY_GOAL: "Rychlý gól",
  MULTIPOINT_GAME: "Vícebodový zápas",
  HATTRICK: "Hattrick",
  BIG_SAVES: "Brankářský výkon",
};

const icons = { BIG_WIN: "✦", EARLY_GOAL: "↗", MULTIPOINT_GAME: "+", HATTRICK: "×3", BIG_SAVES: "◆" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function options(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function card(item, index) {
  const tier = item.importance >= 85 ? "featured" : item.importance >= 72 ? "standard" : "compact";
  const search = [item.title, item.text, item.player, item.team, item.homeTeam, item.awayTeam, labels[item.type]].join(" ");
  return `<button class="feed-card ${tier} type-${item.type.toLowerCase()}" type="button"
    data-id="${escapeHtml(item.id)}" data-search="${escapeHtml(search.toLocaleLowerCase("cs"))}"
    data-season="${escapeHtml(item.season)}" data-group="${escapeHtml(item.group)}"
    data-teams="${escapeHtml(`${item.homeTeam}|${item.awayTeam}`)}" data-phase="${escapeHtml(item.phase)}"
    data-venue="${escapeHtml(item.venue)}" data-sponsor="${escapeHtml(item.sponsor)}"
    aria-label="Otevřít detail: ${escapeHtml(item.title)}" style="--delay:${Math.min(index * 35, 350)}ms">
      <span class="card-icon" aria-hidden="true">${icons[item.type]}</span>
      <span class="card-content">
        <span class="card-topline"><span class="kind">${labels[item.type]}</span><span class="importance">${item.importance}</span></span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="card-text">${escapeHtml(item.text)}</span>
        <span class="matchline"><b>${escapeHtml(item.homeTeam)}</b><i>${item.homeScore}:${item.awayScore}</i><b>${escapeHtml(item.awayTeam)}</b></span>
        <span class="card-footer"><span>${formatDate(item.date)} · ${escapeHtml(item.group)}</span><span>${escapeHtml(item.venue)}</span></span>
      </span>
      ${item.source === "DEMO" ? '<span class="demo-tag">ukázka</span>' : ""}
    </button>`;
}

export function renderPriklepyPage(items) {
  const cards = items.map(card).join("");
  const teams = [...new Set(items.flatMap((item) => [item.homeTeam, item.awayTeam]))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Přehled automaticky nalezených momentů z HMS zápasů">
  <title>Příklepy · HMS Insights</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/priklepy"><span>HMS</span> PŘÍKLEPY</a>
    <div class="top-actions"><span class="live"><i></i> feed</span><button class="avatar" aria-label="Uživatelský účet">W</button></div>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">Hokejové momenty na jednom místě</p><h1>Co právě <em>udeřilo</em></h1></div>
      <p class="intro-copy">Příklepy z dokončených zápasů, seřazené podle důležitosti. Hledejte hráče, tým nebo konkrétní moment.</p>
    </section>

    <section class="filter-panel" aria-label="Filtrování příklepů">
      <label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Hledat hráče, tým nebo moment…" autocomplete="off"></label>
      <div class="filters">
        <label><span>Sezona</span><select data-filter="season"><option value="">Všechny</option>${options(items, "season")}</select></label>
        <label><span>Skupina</span><select data-filter="group"><option value="">Všechny</option>${options(items, "group")}</select></label>
        <label><span>Tým</span><select data-filter="teams"><option value="">Všechny</option>${teams}</select></label>
        <label><span>Fáze</span><select data-filter="phase"><option value="">Všechny</option>${options(items, "phase")}</select></label>
        <label><span>Stadion</span><select data-filter="venue"><option value="">Všechny</option>${options(items, "venue")}</select></label>
        <label><span>Partner</span><select data-filter="sponsor"><option value="">Všichni</option>${options(items, "sponsor")}</select></label>
      </div>
      <div class="filter-status"><p><strong id="result-count">${items.length}</strong> příklepů</p><button id="reset-filters" type="button">Zrušit filtry</button></div>
    </section>

    <section class="feed" aria-live="polite">
      <div class="feed-head"><h2>Nejdůležitější teď</h2><div class="legend"><span><i class="dot high"></i>silný</span><span><i class="dot normal"></i>běžný</span></div></div>
      <div class="feed-grid" id="feed-grid">${cards}</div>
      <div class="empty" id="empty-state" hidden><span>⌕</span><h2>Nic jsme nenašli</h2><p>Zkuste změnit hledání nebo některý z filtrů.</p></div>
    </section>
  </main>

  <dialog id="detail-dialog">
    <button class="dialog-close" type="button" aria-label="Zavřít">×</button>
    <div id="dialog-content"></div>
  </dialog>
  <script type="application/json" id="feed-data">${JSON.stringify(items).replace(/</g, "\\u003c")}</script>
</body>
</html>`;
}
