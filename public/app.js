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

function openDetail(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  const subject = item.player || item.team || "Týmový moment";
  const image = item.playerImageUrl ? `<img class="detail-photo" src="${escapeHtml(item.playerImageUrl)}" alt="${escapeHtml(subject)}" referrerpolicy="no-referrer">` : "";
  dialogContent.innerHTML = `<article class="detail" style="--detail-color:${escapeHtml(item.teamColor || item.groupColor || "#8fe7ff")}">
    <div class="detail-hero">${image}<div><span class="kind">${escapeHtml(item.type.replaceAll("_", " "))} · síla ${item.importance}</span><h2>${escapeHtml(subject)}</h2><h3>${escapeHtml(item.title)}</h3></div></div>
    <p>${escapeHtml(item.text)}</p>
    <div class="detail-score"><strong>${escapeHtml(item.homeTeam)}</strong><b>${item.homeScore}:${item.awayScore}</b><strong>${escapeHtml(item.awayTeam)}</strong></div>
    <div class="detail-meta">
      <div><span>Datum</span><b>${new Intl.DateTimeFormat("cs-CZ").format(new Date(`${item.date}T12:00:00`))}</b></div>
      <div><span>Soutěž / skupina</span><b>${escapeHtml(item.competition)} · ${escapeHtml(item.group)}</b></div>
      <div><span>Fáze / stadion</span><b>${escapeHtml(item.phase)} · ${escapeHtml(item.venue)}</b></div>
      <div><span>Partner</span><b>${escapeHtml(item.sponsor)}</b></div>
    </div>
  </article>`;
  dialog.showModal();
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
cards.forEach((card) => card.addEventListener("click", () => openDetail(card.dataset.id)));
dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => image.remove()));
applyFilters();
