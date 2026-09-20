const labels = {
  BIG_WIN: "Velká výhra",
  EARLY_GOAL: "Rychlý gól",
  MULTIPOINT_GAME: "Vícebodový zápas",
  HATTRICK: "Hattrick",
  BIG_SAVES: "Brankářský výkon",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function safeColor(value, fallback = "#8fe7ff") {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : fallback;
}

function initials(value) {
  return String(value ?? "HMS").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function options(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function momentStat(item) {
  if (item.type === "HATTRICK") return "HATTRICK";
  if (item.type === "BIG_SAVES") return `${item.facts?.saves ?? "30+"} ZÁKROKŮ`;
  if (item.type === "MULTIPOINT_GAME") return `${item.facts?.points ?? "2+"} BODY`;
  if (item.type === "EARLY_GOAL") return `GÓL ${item.facts?.gameTime ?? "BRZY"}`;
  if (item.type === "BIG_WIN") return `VÝHRA +${item.facts?.scoreDifference ?? "5"}`;
  return labels[item.type] ?? item.type;
}

function outstandingStatus(item) {
  if (item.type === "HATTRICK" || item.importance >= 95) return { className: "on-fire", icon: "🔥", label: "On fire" };
  if (item.importance >= 88) return { className: "top-moment", icon: "★", label: "Top moment" };
  if (item.importance >= 82) return { className: "trending", icon: "↗", label: "Trending" };
  return null;
}

function card(item, index) {
  const outstanding = outstandingStatus(item);
  const subject = item.player || item.team || "Týmový moment";
  const search = [item.title, item.text, item.player, item.team, item.homeTeam, item.awayTeam, labels[item.type]].join(" ");
  const photo = item.playerImageUrl
    ? `<img src="${escapeHtml(item.playerImageUrl)}" alt="${escapeHtml(subject)}" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const teamMark = item.teamLogoUrl
    ? `<img class="row-team-logo" src="${escapeHtml(item.teamLogoUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="row-team-fallback" aria-hidden="true">${escapeHtml(initials(item.team))}</span>`;
  const groupMark = item.groupLogoUrl
    ? `<img class="entity-logo group-logo" src="${escapeHtml(item.groupLogoUrl)}" alt="">`
    : "<i></i>";
  const venueMark = item.venueLogoUrl
    ? `<img class="entity-logo venue-logo" src="${escapeHtml(item.venueLogoUrl)}" alt="">`
    : "";
  const gameLinkAttributes = item.gameDetailUrl
    ? `data-game-url="${escapeHtml(item.gameDetailUrl)}" title="Otevřít detail zápasu v HMS"`
    : "";

  const outstandingBadge = outstanding
    ? `<span class="outstanding-badge ${outstanding.className}"><b>${outstanding.icon}</b>${outstanding.label}</span>`
    : "";

  return `<button class="moment-card feed-row ${outstanding?.className ?? ""}" type="button"
    data-id="${escapeHtml(item.id)}" data-search="${escapeHtml(search.toLocaleLowerCase("cs"))}"
    data-season="${escapeHtml(item.season)}" data-group="${escapeHtml(item.group)}"
    data-teams="${escapeHtml(`${item.homeTeam}|${item.awayTeam}`)}" data-phase="${escapeHtml(item.phase)}"
    data-venue="${escapeHtml(item.venue)}" data-sponsor="${escapeHtml(item.sponsor)}"
    aria-label="Otevřít detail: ${escapeHtml(item.title)}"
    style="--team:${safeColor(item.teamColor)};--group:${safeColor(item.groupColor, "#a454ff")};--delay:${Math.min(index * 35, 350)}ms">
      <span class="row-accent" aria-hidden="true"></span>
      <span class="row-avatar"><span class="photo-fallback">${escapeHtml(initials(subject))}</span>${photo}</span>
      <span class="row-story">
        <span class="row-flags">${outstandingBadge}<span class="group-badge">${groupMark}${escapeHtml(item.group)}</span></span>
        <span class="row-title"><strong class="moment-stat">${escapeHtml(momentStat(item))}</strong><b class="subject-name">${escapeHtml(subject)}</b></span>
        <span class="moment-copy">${escapeHtml(item.text)}</span>
      </span>
      <span class="row-game">
        <span class="game-line" ${gameLinkAttributes}><b>${escapeHtml(item.homeTeam)}</b><i>${item.homeScore}:${item.awayScore}</i><b>${escapeHtml(item.awayTeam)}</b></span>
        <span class="row-context"><span class="venue-name">${venueMark}${escapeHtml(item.venue)}</span><span>${formatDate(item.date)}</span></span>
      </span>
      <span class="row-team">${teamMark}</span>
      <span class="row-open" aria-hidden="true">›</span>
      ${item.source === "DEMO" ? '<span class="demo-tag">ukázka</span>' : ""}
    </button>`;
}

function dateSections(items) {
  const newest = items.map((item) => item.date).sort().at(-1);
  const newestTime = new Date(`${newest}T12:00:00`).getTime();
  const groups = [
    { label: "Nejnovější", key: "latest", items: [] },
    { label: "Včera", key: "yesterday", items: [] },
    { label: "Dříve", key: "earlier", items: [] },
  ];
  for (const item of items) {
    const days = Math.round((newestTime - new Date(`${item.date}T12:00:00`).getTime()) / 86400000);
    groups[days === 0 ? 0 : days === 1 ? 1 : 2].items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

export function renderPriklepyPage(items) {
  let cardIndex = 0;
  const sections = dateSections(items).map((section) => `
    <section class="date-section" data-feed-section>
      <div class="date-heading"><h2>${section.label}</h2><span></span><b data-section-count>${section.items.length}</b></div>
      <div class="feed-list">${section.items.map((item) => card(item, cardIndex++)).join("")}</div>
    </section>`).join("");
  const teams = [...new Set(items.flatMap((item) => [item.homeTeam, item.awayTeam]))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Přehled automaticky nalezených hokejových momentů z HMS zápasů">
  <title>Příklepy · HMS Insights</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./styles.css?v=stream-1">
  <script src="./app.js?v=stream-1" defer></script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="./"><span>HMS</span> PŘÍKLEPY</a>
    <span class="feed-state"><i></i> živý přehled</span>
  </header>
  <main>
    <section class="control-bar" aria-label="Vyhledávání a filtrování příklepů">
      <label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Hledat hráče, tým nebo moment…" autocomplete="off"></label>
      <button class="filter-toggle" id="filter-toggle" type="button" aria-expanded="false" aria-controls="filters"><span>Filtry</span><b id="active-filter-count" hidden>0</b><i aria-hidden="true">⌄</i></button>
      <div class="filter-drawer" id="filters" hidden>
        <div class="filters">
          <label><span>Sezona</span><select data-filter="season"><option value="">Všechny</option>${options(items, "season")}</select></label>
          <label><span>Skupina</span><select data-filter="group"><option value="">Všechny</option>${options(items, "group")}</select></label>
          <label><span>Tým</span><select data-filter="teams"><option value="">Všechny</option>${teams}</select></label>
          <label><span>Fáze</span><select data-filter="phase"><option value="">Všechny</option>${options(items, "phase")}</select></label>
          <label><span>Stadion</span><select data-filter="venue"><option value="">Všechny</option>${options(items, "venue")}</select></label>
          <label><span>Partner</span><select data-filter="sponsor"><option value="">Všichni</option>${options(items, "sponsor")}</select></label>
        </div>
        <button id="reset-filters" type="button">Zrušit všechny filtry</button>
      </div>
      <p class="result-line"><strong id="result-count">${items.length}</strong> příklepů</p>
    </section>

    <div class="timeline" id="feed" aria-live="polite">${sections}</div>
    <div class="empty" id="empty-state" hidden><span>⌕</span><h2>Nic jsme nenašli</h2><p>Zkuste změnit hledání nebo některý z filtrů.</p></div>
  </main>

  <dialog id="detail-dialog"><button class="dialog-close" type="button" aria-label="Zavřít">×</button><div id="dialog-content"></div></dialog>
  <script type="application/json" id="feed-data">${JSON.stringify(items).replace(/</g, "\\u003c")}</script>
</body>
</html>`;
}
