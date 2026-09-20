const cards = [...document.querySelectorAll(".moment-card")];
const sections = [...document.querySelectorAll("[data-feed-section]")];
const search = document.querySelector("#search");
const selects = [...document.querySelectorAll("[data-filter]")];
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const reset = document.querySelector("#reset-filters");
const filterToggle = document.querySelector("#filter-toggle");
const filterDrawer = document.querySelector("#filters");
const activeFilterCount = document.querySelector("#active-filter-count");
const dialog = document.querySelector("#detail-dialog");
const dialogContent = document.querySelector("#dialog-content");
const items = JSON.parse(document.querySelector("#feed-data").textContent);

function applyFilters() {
  const query = search.value.trim().toLocaleLowerCase("cs");
  const active = selects.filter((select) => select.value).length;
  let visible = 0;
  cards.forEach((card) => {
    const matchesSearch = !query || card.dataset.search.includes(query);
    const matchesFilters = selects.every((select) => {
      if (!select.value) return true;
      const value = card.dataset[select.dataset.filter] ?? "";
      return select.dataset.filter === "teams" ? value.split("|").includes(select.value) : value === select.value;
    });
    card.hidden = !(matchesSearch && matchesFilters);
    if (!card.hidden) visible += 1;
  });
  sections.forEach((section) => {
    const sectionVisible = [...section.querySelectorAll(".moment-card")].filter((card) => !card.hidden).length;
    section.hidden = sectionVisible === 0;
    section.querySelector("[data-section-count]").textContent = sectionVisible;
  });
  count.textContent = visible;
  empty.hidden = visible !== 0;
  activeFilterCount.textContent = active;
  activeFilterCount.hidden = active === 0;
  reset.disabled = !query && active === 0;
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
    BIG_WIN: "VELKÁ VÝHRA",
    EARLY_GOAL: "RYCHLÝ GÓL",
    MULTIPOINT_GAME: "VÍCEBODOVÝ ZÁPAS",
    HATTRICK: "HATTRICK",
    BIG_SAVES: "BRANKÁŘSKÝ VÝKON",
  })[type] ?? type.replaceAll("_", " ");
}

function achievementStat(item) {
  if (item.type === "HATTRICK") return "HATTRICK";
  if (item.type === "BIG_SAVES") return `${item.facts?.saves ?? "30+"} ZÁKROKŮ`;
  if (item.type === "MULTIPOINT_GAME") return `${item.facts?.points ?? "2+"} BODY`;
  if (item.type === "EARLY_GOAL") return `GÓL ${item.facts?.gameTime ?? "BRZY"}`;
  if (item.type === "BIG_WIN") return `VÝHRA +${item.facts?.scoreDifference ?? "5"}`;
  return achievementLabel(item.type);
}

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
  const subject = item.player || item.team || "Týmový moment";
  const data = {
    title: `${achievementStat(item)} · ${subject}`,
    text: `${item.text} — HMS Příklepy`,
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
  button.innerHTML = "✓ Odkaz zkopírován";
  setTimeout(() => { button.innerHTML = original; }, 1800);
}

function openDetail(id, updateUrl = true) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  const subject = item.player || item.team || "Týmový moment";
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
  dialogContent.innerHTML = `<article class="share-card" style="--card-team:${safeColor(item.teamColor, "#8fe7ff")};--card-group:${safeColor(item.groupColor, "#a454ff")}">
    ${teamLogo}
    <header class="share-head"><span class="share-brand"><b>HMS</b> PŘÍKLEPY</span><span class="share-group">${groupLogo}${escapeHtml(item.group)}</span></header>
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
      <div class="share-context"><span>${venueLogo}${escapeHtml(item.venue)}</span><span>${new Intl.DateTimeFormat("cs-CZ").format(new Date(`${item.date}T12:00:00`))}</span><small>síla ${item.importance}</small></div>
    </footer>
  </article>`;
  dialog.showModal();
  if (updateUrl) history.replaceState(null, "", `#priklep=${encodeURIComponent(item.id)}`);
  dialogContent.querySelector(".share-action").addEventListener("click", (event) => shareMoment(item, event.currentTarget));
  dialogContent.querySelectorAll("img").forEach((imageNode) => imageNode.addEventListener("error", () => imageNode.remove()));
}

function closeDetail() {
  dialog.close();
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

filterToggle.addEventListener("click", () => {
  const open = filterDrawer.hidden;
  filterDrawer.hidden = !open;
  filterToggle.setAttribute("aria-expanded", String(open));
});
search.addEventListener("input", applyFilters);
selects.forEach((select) => select.addEventListener("change", applyFilters));
reset.addEventListener("click", () => {
  search.value = "";
  selects.forEach((select) => { select.value = ""; });
  applyFilters();
  search.focus();
});
cards.forEach((card) => card.addEventListener("click", (event) => {
  const gameLink = event.target.closest("[data-game-url]");
  if (gameLink) {
    window.open(gameLink.dataset.gameUrl, "_blank", "noopener");
    return;
  }
  openDetail(card.dataset.id);
}));
dialog.querySelector(".dialog-close").addEventListener("click", closeDetail);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDetail(); });
document.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => image.remove()));
applyFilters();

const initialMoment = new URLSearchParams(window.location.hash.slice(1)).get("priklep");
if (initialMoment) openDetail(initialMoment, false);
