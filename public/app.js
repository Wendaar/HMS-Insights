import {feedLanguage,feedLocale,feedText,feedHtml,insightCopy,insightStat} from './insights-i18n.js';
const search = document.querySelector("#search");
const selects = [...document.querySelectorAll("[data-filter]")];
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const feed = document.querySelector("#feed");
const sentinel = document.querySelector("#feed-sentinel");
const reset = document.querySelector("#reset-filters");
const filterToggle = document.querySelector("#filter-toggle");
const filterDrawer = document.querySelector("#filters");
const activeFilterCount = document.querySelector("#active-filter-count");
const dialog = document.querySelector("#detail-dialog");
const dialogContent = document.querySelector("#dialog-content");
let items = JSON.parse(document.querySelector("#feed-data").textContent);
let feedMeta = JSON.parse(document.querySelector("#feed-meta").textContent);
const lang=feedLanguage(feedMeta.lang,feedMeta.organization),t=value=>feedText(value,lang);
let newestDate = items[0]?.date ?? null;
let loading = false;
let requestVersion = 0;
const isArchive = feedMeta.mode === "archive";
const embeddedTeamId = feedMeta.teamId;
const feedOrganization = feedMeta.organization ?? "PHM";

function updateControls(resultTotal = feedMeta.total) {
  const active = selects.filter((select) => select.value).length;
  if (count) count.textContent = resultTotal;
  empty.hidden = resultTotal !== 0;
  sentinel.hidden = !feedMeta.hasMore;
  if (activeFilterCount) {
    activeFilterCount.textContent = active;
    activeFilterCount.hidden = active === 0;
  }
  if (reset) reset.disabled = !(search?.value.trim()) && active === 0;
}

function sectionFor(date) {
  if (!newestDate) return { key: "latest", label: t("Nejnovější") };
  const days = Math.round((new Date(`${newestDate}T12:00:00`) - new Date(`${date}T12:00:00`)) / 86400000);
  return days === 0
    ? { key: "latest", label: t("Nejnovější") }
    : days === 1
      ? { key: "yesterday", label: t("Včera") }
      : { key: "earlier", label: t("Dříve") };
}

function ensureSection(info) {
  let section = feed.querySelector(`[data-section-key="${info.key}"]`);
  if (section) return section;
  section = document.createElement("section");
  section.className = "date-section";
  section.dataset.feedSection = "";
  section.dataset.sectionKey = info.key;
  section.innerHTML = `<div class="date-heading"><h2>${info.label}</h2><span></span><b data-section-count>0</b></div><div class="feed-list"></div>`;
  feed.append(section);
  return section;
}

function appendPage(page, replace) {
  if (replace) {
    feed.replaceChildren();
    items = [];
    newestDate = page.items[0]?.date ?? null;
  }
  const holder = document.createElement("div");
  holder.innerHTML = page.html;
  const cards = [...holder.children];
  page.items.forEach((item, index) => {
    const section = ensureSection(sectionFor(item.date));
    section.querySelector(".feed-list").append(cards[index]);
    section.querySelector("[data-section-count]").textContent = section.querySelectorAll(".moment-card").length;
  });
  items.push(...page.items);
  feedMeta = { total: page.total, hasMore: page.hasMore };
  updateControls();
}

function feedParams(offset) {
  const params = new URLSearchParams({ lang, org: feedOrganization, limit: "40", offset: String(offset) });
  if (embeddedTeamId) params.set("teamId", embeddedTeamId);
  if (search?.value.trim()) params.set("q", search.value.trim());
  selects.forEach((select) => {
    if (!select.value) return;
    params.set(select.dataset.filter === "teams" ? "team" : select.dataset.filter, select.value);
  });
  return params;
}

async function loadPage(replace = false) {
  if (loading && !replace) return;
  const version = replace ? ++requestVersion : requestVersion;
  loading = true;
  sentinel.textContent = t("Načítám starší Příklepy…");
  try {
    const endpoint = isArchive ? "/api/feed" : "/api/selection";
    const response = await fetch(`${endpoint}?${feedParams(replace ? 0 : items.length)}`);
    const page = await response.json();
    if (!response.ok) throw new Error(t("Příklepy se nepodařilo načíst."));
    if (version !== requestVersion) return;
    if (page.organization !== feedOrganization) throw new Error(t("Zdroj neodpovídá organizaci této stránky."));
    appendPage(page, replace);
  } catch (error) {
    sentinel.hidden = false;
    sentinel.textContent = `${error.message} ${t("Posuňte stránku znovu pro další pokus.")}`;
  } finally {
    if (version === requestVersion) loading = false;
  }
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value ?? "";
  return node.innerHTML;
}

function usableImage(value) {
  return typeof value === "string" && value.startsWith("http") && !value.includes("[size]");
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : fallback;
}

function achievementLabel(type) {
  return ({
    BIG_WIN: t("VELKÁ VÝHRA"),
    EARLY_GOAL: t("RYCHLÝ GÓL"),
    MULTIPOINT_GAME: t("VÍCEBODOVÝ ZÁPAS"),
    HATTRICK: "HATTRICK",
    BIG_SAVES: t("BRANKÁŘSKÝ VÝKON"),
  })[type] ?? type.replaceAll("_", " ");
}

function achievementStat(item) {return insightStat(item,lang);}

function outstandingLabel(item) {
  if (item.type === "HATTRICK" || item.importance >= 95) return "🔥 ON FIRE";
  if (item.importance >= 88) return "★ TOP MOMENT";
  if (item.importance >= 82) return "↗ TRENDING";
  return "";
}

function detailUrl(id) {
  const url = new URL(window.location.href);
  url.hash = `priklep=${encodeURIComponent(id)}`;
  return url.toString();
}

async function shareMoment(item, button) {
  const subject = item.player || item.team || t("Týmový moment");
  const data = {
    title: `${achievementStat(item)} · ${subject}`,
    text: `${item.text} — HMS ${lang==='en'?'Insights':'Příklepy'}`,
    url: detailUrl(item.id),
  };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(data.url);
  const original = button.innerHTML;
  button.innerHTML = t("✓ Odkaz zkopírován");
  setTimeout(() => { button.innerHTML = original; }, 1800);
}

function openDetail(id, updateUrl = true) {
  const original = items.find((candidate) => candidate.id === id);
  if (!original) return;
  const item=insightCopy(original,lang);
  const subject = item.player || item.team || t("Týmový moment");
  const subjectInitials = subject.split(/\s+/).map((part) => part[0]).slice(0,2).join("");
  const hasPlayerImage = usableImage(item.playerImageUrl);
  const hasTeamLogo = usableImage(item.teamLogoUrl);
  const foregroundImage = hasPlayerImage
    ? `<img class="share-player" src="${escapeHtml(item.playerImageUrl)}" alt="${escapeHtml(subject)}" referrerpolicy="no-referrer">`
    : hasTeamLogo
      ? `<img class="share-player share-player-team" src="${escapeHtml(item.teamLogoUrl)}" alt="${escapeHtml(item.team)}" referrerpolicy="no-referrer">`
      : "";
  const missingPlayerBadge = item.player && !hasPlayerImage && hasTeamLogo
    ? `<span class="share-missing-initials">${escapeHtml(subjectInitials)}</span>`
    : "";
  const image = `<span class="share-player-fallback">${escapeHtml(subjectInitials)}</span>${foregroundImage}${missingPlayerBadge}`;
  const teamLogo = usableImage(item.teamLogoUrl)
    ? `<img class="share-team-logo" src="${escapeHtml(item.teamLogoUrl)}" alt="">`
    : `<span class="share-team-fallback">${escapeHtml((item.team || "HMS").split(/\s+/).map((part) => part[0]).slice(0,3).join(""))}</span>`;
  const groupLogo = usableImage(item.groupLogoUrl || item.groupLogoTemplateUrl)
    ? `<img src="${escapeHtml(item.groupLogoUrl || item.groupLogoTemplateUrl)}" alt="${escapeHtml(item.group)}">`
    : `<i style="--group-color:${escapeHtml(item.groupColor || "#a454ff")}"></i>`;
  const venueLogo = usableImage(item.venueLogoUrl || item.venueLogoTemplateUrl)
    ? `<img src="${escapeHtml(item.venueLogoUrl || item.venueLogoTemplateUrl)}" alt="">`
    : "";
  const scoreContent = `<span>${escapeHtml(item.homeTeam)}</span><b>${item.homeScore}:${item.awayScore}</b><span>${escapeHtml(item.awayTeam)}</span>`;
  const score = item.gameDetailUrl
    ? `<a class="share-score" href="${escapeHtml(item.gameDetailUrl)}" target="_blank" rel="noopener" title="Otevřít detail zápasu v HMS">${scoreContent}</a>`
    : `<div class="share-score">${scoreContent}</div>`;
  const status = outstandingLabel(item);
  dialogContent.innerHTML = feedHtml(`<article class="share-card" style="--card-team:${safeColor(item.teamColor, "#8fe7ff")};--card-group:${safeColor(item.groupColor, "#a454ff")}">
    ${teamLogo}
    <header class="share-head"><span class="share-brand"><span class="hms-brand"><a class="hms-company" href="https://www.heromanagementsystem.com/" target="_blank" rel="noopener noreferrer" aria-label="HMS · Hero Management System"><span class="hms-logo"><img src="/hms-logo.png" width="3508" height="3508" alt="HMS · Hero Management System"></span></a><span class="hms-product">PŘÍKLEPY</span></span></span><span class="share-group">${groupLogo}${escapeHtml(item.group)}</span></header>
    <div class="share-copy">
      ${status ? `<span class="share-status">${escapeHtml(status)}</span>` : ""}
      <span class="share-achievement">✦ ${escapeHtml(achievementLabel(item.type))}</span>
      <strong class="share-stat">${escapeHtml(achievementStat(item))}</strong>
      <h2>${escapeHtml(subject)}</h2>
      <p>${escapeHtml(item.text)}</p>
    </div>
    <div class="share-player-wrap">${image}</div>
    <button class="share-action" type="button" aria-label="Sdílet tento Příklep"><span>↗</span> Sdílet</button>
    <footer class="share-foot">
      ${score}
      <div class="share-context"><span>${venueLogo}${escapeHtml(item.venue)}</span><span>${new Intl.DateTimeFormat(feedLocale(lang)).format(new Date(`${item.date}T12:00:00`))}</span><small>${lang==='en'?'impact':'síla'} ${item.importance}</small></div>
    </footer>
  </article>`,lang,[item.player,item.team,item.homeTeam,item.awayTeam,item.group,item.venue].filter(Boolean).map(escapeHtml));
  if (/^\/game-center\/[0-9a-f-]{36}$/i.test(item.gameReportUrl ?? "")) {
    const reportLink = document.createElement("a");
    reportLink.href = item.gameReportUrl+'?lang='+lang;reportLink.target='_blank';reportLink.rel='noopener noreferrer';
    reportLink.textContent = t("Otevřít Game Report →");
    reportLink.className = "game-report-link";
    dialogContent.append(reportLink);
  }
  dialog.showModal();
  if (updateUrl) history.replaceState(null, "", `#priklep=${encodeURIComponent(item.id)}`);
  dialogContent.querySelector(".share-action").addEventListener("click", (event) => shareMoment(item, event.currentTarget));
  dialogContent.querySelectorAll("img").forEach((imageNode) => imageNode.addEventListener("error", () => imageNode.remove()));
}

function closeDetail() {
  dialog.close();
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

if (filterToggle && filterDrawer) filterToggle.addEventListener("click", () => {
  const open = filterDrawer.hidden;
  filterDrawer.hidden = !open;
  filterToggle.setAttribute("aria-expanded", String(open));
});
let searchTimer;
search?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadPage(true), 350);
  updateControls();
});
selects.forEach((select) => select.addEventListener("change", () => loadPage(true)));
reset?.addEventListener("click", () => {
  search.value = "";
  selects.forEach((select) => { select.value = ""; });
  loadPage(true);
  search.focus();
});
feed.addEventListener("click", (event) => {
  const card = event.target.closest(".moment-card");
  if (!card) return;
  const gameLink = event.target.closest("[data-game-url]");
  if (gameLink) {
    window.open(gameLink.dataset.gameUrl, "_blank", "noopener");
    return;
  }
  openDetail(card.dataset.id);
});
dialog.querySelector(".dialog-close").addEventListener("click", closeDetail);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDetail(); });
document.addEventListener("error", (event) => { if (event.target instanceof HTMLImageElement) event.target.remove(); }, true);
updateControls();

if (isArchive) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && feedMeta.hasMore) loadPage(false);
  }, { rootMargin: "500px 0px" });
  observer.observe(sentinel);
}

const initialMoment = new URLSearchParams(window.location.hash.slice(1)).get("priklep");
if (initialMoment) openDetail(initialMoment, false);

for(const link of document.querySelectorAll('.feed-language a')){
 link.hash=location.hash;
 link.addEventListener('click',()=>{const next=new URL(link.href);const selected=feedParams(0);for(const [key,value]of selected)if(!['org','limit','offset','lang'].includes(key))next.searchParams.set(key,value);link.href=next.href;});
}
const initialParams=new URLSearchParams(location.search);if(search)search.value=initialParams.get('q')??'';
for(const select of selects){const value=initialParams.get(select.dataset.filter==='teams'?'team':select.dataset.filter);if(value&&[...select.options].some(o=>o.value===value))select.value=value;}
updateControls();
