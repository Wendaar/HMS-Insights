import {feedLanguage,feedLocale,feedHtml,insightCopy,insightStat} from '../../public/insights-i18n.js';
import {hmsBrand} from '../../public/hms-brand.js';
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

function formatDate(date,lang) {
  return new Intl.DateTimeFormat(feedLocale(lang), { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function options(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function optionValues(values = []) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function momentStat(item,lang) {return insightStat(item,lang);}

function outstandingStatus(item) {
  if (item.type === "HATTRICK" || item.importance >= 95) return { className: "on-fire", icon: "🔥", label: "On fire" };
  if (item.importance >= 88) return { className: "top-moment", icon: "★", label: "Top moment" };
  if (item.importance >= 82) return { className: "trending", icon: "↗", label: "Trending" };
  return null;
}

function card(original, index, lang='cs') {
  const item=insightCopy(original,lang);
  const outstanding = outstandingStatus(item);
  const subject = item.player || item.team || "Týmový moment";
  const search = [item.title, item.text, item.player, item.team, item.homeTeam, item.awayTeam, labels[item.type]].join(" ");
  const avatarImage = item.playerImageUrl
    ? `<img src="${escapeHtml(item.playerImageUrl)}" alt="${escapeHtml(subject)}" loading="lazy" referrerpolicy="no-referrer">`
    : item.teamLogoUrl
      ? `<img class="row-team-placeholder" src="${escapeHtml(item.teamLogoUrl)}" alt="${escapeHtml(item.team)}" loading="lazy" referrerpolicy="no-referrer">`
      : "";
  const missingPlayerBadge = item.player && !item.playerImageUrl && item.teamLogoUrl
    ? `<span class="row-player-initials">${escapeHtml(initials(item.player))}</span>`
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
    data-date="${escapeHtml(item.date)}"
    data-season="${escapeHtml(item.season)}" data-group="${escapeHtml(item.group)}"
    data-teams="${escapeHtml(`${item.homeTeam}|${item.awayTeam}`)}" data-phase="${escapeHtml(item.phase)}"
    data-venue="${escapeHtml(item.venue)}" data-sponsor="${escapeHtml(item.sponsor)}"
    aria-label="Otevřít detail: ${escapeHtml(item.title)}"
    style="--team:${safeColor(item.teamColor)};--group:${safeColor(item.groupColor, "#a454ff")};--delay:${Math.min(index * 35, 350)}ms">
      <span class="row-accent" aria-hidden="true"></span>
      <span class="row-avatar"><span class="photo-fallback">${escapeHtml(initials(subject))}</span>${avatarImage}${missingPlayerBadge}</span>
      <span class="row-story">
        <span class="row-flags">${outstandingBadge}<span class="group-badge">${groupMark}${escapeHtml(item.group)}</span></span>
        <span class="row-title"><strong class="moment-stat">${escapeHtml(momentStat(item,lang))}</strong><b class="subject-name">${escapeHtml(subject)}</b></span>
        <span class="moment-copy">${escapeHtml(item.text)}</span>
      </span>
      <span class="row-game">
        <span class="game-line" ${gameLinkAttributes}><b>${escapeHtml(item.homeTeam)}</b><i>${item.homeScore}:${item.awayScore}</i><b>${escapeHtml(item.awayTeam)}</b></span>
        <span class="row-context"><span class="venue-name">${venueMark}${escapeHtml(item.venue)}</span><span>${formatDate(item.date,lang)}</span></span>
      </span>
      <span class="row-team">${teamMark}</span>
      <span class="row-open" aria-hidden="true">›</span>
      ${item.source === "DEMO" ? '<span class="demo-tag">ukázka</span>' : ""}
    </button>`;
}

export function renderFeedCards(items, startIndex = 0,lang='cs') {
  return feedHtml(items.map((item, index) => card(item, startIndex + index,lang)).join(""),lang,items.flatMap(item=>[item.player,item.team,item.homeTeam,item.awayTeam,item.group,item.season,item.venue]).map(value=>escapeHtml(value)));
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

export function renderPriklepyPage(items, config = {}) {
  const lang=feedLanguage(config.lang,config.organization?.code??'PHM');
  const filterOptions = config.filterOptions ?? {};
  const total = Number(config.total ?? items.length);
  const hasMore = Boolean(config.hasMore);
  const mode = config.mode ?? "archive";
  const isSelection = mode === "selection";
  const organization=config.organization??null;
  const suffix=organization&&organization.code!=='PHM'?`/${encodeURIComponent(organization.slug)}`:'';
  const selectionPath=`/priklepy${suffix}`,archivePath=`/archiv${suffix}`;
  const assetPrefix=organization?'/':'./';
  const selectionTitle = config.teamName ? (lang==='en'?`Highlights for ${config.teamName}`:`To nejlepší pro ${config.teamName}`) : (lang==='en'?'The best from the ice':'To nejlepší z ledu');
  let cardIndex = 0;
  const sections = dateSections(items).map((section) => `
    <section class="date-section" data-feed-section data-section-key="${section.key}">
      <div class="date-heading"><h2>${section.label}</h2><span></span><b data-section-count>${section.items.length}</b></div>
      <div class="feed-list">${section.items.map((item) => card(item, cardIndex++,lang)).join("")}</div>
    </section>`).join("");
  const teams = [...new Set(items.flatMap((item) => [item.homeTeam, item.awayTeam]))]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

  const markup = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Přehled automaticky nalezených hokejových momentů z HMS zápasů">
  <title>${organization?escapeHtml(organization.name)+" · ":""}${lang==='en'?'Insights':'Příklepy'} · HMS Insights</title>
  <link rel="icon" type="image/png" sizes="32x32" href="${assetPrefix}hms-favicon-public-v2.png"><link rel="icon" type="image/svg+xml" sizes="any" href="${assetPrefix}hms-favicon-public-v2.svg">
  <link rel="stylesheet" href="${assetPrefix}styles.css?v=org-feeds-1">
  <script type="module" src="${assetPrefix}app.js?v=org-feeds-2"></script>
<link rel="stylesheet" href="${assetPrefix}hms-brand.css"></head>
<body>
  <header class="topbar">
    ${hmsBrand('PŘÍKLEPY',assetPrefix)}
    <nav class="view-nav" aria-label="Pohled Příklepů">
      <a href="${selectionPath}?lang=${lang}" ${isSelection ? 'aria-current="page"' : ""}>Výběr</a>
      ${isSelection ? "" : `<a href="${archivePath}?lang=${lang}" aria-current="page">Archiv</a>`}
    </nav>
    <nav class="feed-language" aria-label="Language"><a href="${isSelection?selectionPath:archivePath}?lang=cs${config.teamId?'&amp;teamId='+encodeURIComponent(config.teamId):''}" lang="cs" ${lang==='cs'?'aria-current="true"':''}>CZ</a><a href="${isSelection?selectionPath:archivePath}?lang=en${config.teamId?'&amp;teamId='+encodeURIComponent(config.teamId):''}" lang="en" ${lang==='en'?'aria-current="true"':''}>EN</a></nav>
    <span class="feed-state"><i></i> ${organization?escapeHtml(organization.name)+" · ":""}živý přehled</span>
  </header>
  <main>
    ${isSelection ? `<section class="selection-intro">
      <div><span>${organization?escapeHtml(organization.name)+" · ":""}VÝBĚR PŘÍKLEPŮ</span><h1>${escapeHtml(selectionTitle)}</h1><p>Nejsilnější momenty posledních dnů. U jednoho hráče v jednom zápase ukazujeme vždy jen jeho nejvýznamnější příběh.</p></div>
      <p class="selection-count"><strong id="result-count">${total}</strong><span>vybraných momentů</span></p>
    </section>` : `<section class="archive-intro"><span>${organization?escapeHtml(organization.name)+" · ":""}ÚPLNÁ HISTORIE</span><h1>Archiv Příklepů</h1><p>Procházejte všechny nalezené momenty napříč zápasy, hráči a týmy.</p></section>`}
    <section class="control-bar" aria-label="Vyhledávání a filtrování příklepů">
      <label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Hledat hráče, tým nebo moment…" autocomplete="off"></label>
      <button class="filter-toggle" id="filter-toggle" type="button" aria-expanded="false" aria-controls="filters"><span>Filtry</span><b id="active-filter-count" hidden>0</b><i aria-hidden="true">⌄</i></button>
      <div class="filter-drawer ${isSelection ? "selection-filters" : ""}" id="filters" hidden>
        <div class="filters">
          ${isSelection ? "" : `<label><span>Sezona</span><select data-filter="season"><option value="">Všechny</option>${filterOptions.seasons ? optionValues(filterOptions.seasons) : options(items, "season")}</select></label>`}
          <label><span>Skupina</span><select data-filter="group"><option value="">Všechny</option>${filterOptions.groups ? optionValues(filterOptions.groups) : options(items, "group")}</select></label>
          <label><span>Tým</span><select data-filter="teams"><option value="">Všechny</option>${filterOptions.teams ? optionValues(filterOptions.teams) : teams}</select></label>
          ${isSelection ? "" : `<label><span>Fáze</span><select data-filter="phase"><option value="">Všechny</option>${filterOptions.phases ? optionValues(filterOptions.phases) : options(items, "phase")}</select></label>
          <label><span>Stadion</span><select data-filter="venue"><option value="">Všechny</option>${filterOptions.venues ? optionValues(filterOptions.venues) : options(items, "venue")}</select></label>
          <label><span>Partner</span><select data-filter="sponsor"><option value="">Všichni</option>${filterOptions.sponsors ? optionValues(filterOptions.sponsors) : options(items, "sponsor")}</select></label>`}
        </div>
        <button id="reset-filters" type="button">Zrušit všechny filtry</button>
      </div>
      ${isSelection ? "" : `<p class="result-line"><strong id="result-count">${total}</strong> příklepů</p>`}
    </section>

    <div class="timeline" id="feed" aria-live="polite">${sections}</div>
    <div id="feed-sentinel" class="feed-sentinel" ${!isSelection && hasMore ? "" : "hidden"}>Načítám starší Příklepy…</div>
    <div class="empty" id="empty-state" hidden><span>⌕</span><h2>Nic jsme nenašli</h2><p>Zkuste změnit hledání nebo některý z filtrů.</p></div>
  </main>

  <dialog id="detail-dialog"><button class="dialog-close" type="button" aria-label="Zavřít">×</button><div id="dialog-content"></div></dialog>
  <script type="application/json" id="feed-data">${JSON.stringify(items).replace(/</g, "\\u003c")}</script>
  <script type="application/json" id="feed-meta">${JSON.stringify({ total, hasMore: !isSelection && hasMore, mode, lang, organization: organization?.code ?? "PHM", teamId: config.teamId ?? null }).replace(/</g, "\\u003c")}</script>
</body>
</html>`;
  return feedHtml(markup,lang,items.flatMap(item=>[item.player,item.team,item.homeTeam,item.awayTeam,item.group,item.season,item.venue]).map(value=>escapeHtml(value)));
}
