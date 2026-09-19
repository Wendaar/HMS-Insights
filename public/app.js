const cards = [...document.querySelectorAll(".feed-card")];
const search = document.querySelector("#search");
const selects = [...document.querySelectorAll("[data-filter]")];
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const reset = document.querySelector("#reset-filters");
const dialog = document.querySelector("#detail-dialog");
const dialogContent = document.querySelector("#dialog-content");
const items = JSON.parse(document.querySelector("#feed-data").textContent);

function applyFilters() {
  const query = search.value.trim().toLocaleLowerCase("cs");
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
  count.textContent = visible;
  empty.hidden = visible !== 0;
  reset.disabled = !query && selects.every((select) => !select.value);
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value ?? "";
  return node.innerHTML;
}

function openDetail(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  dialogContent.innerHTML = `<article class="detail">
    <span class="kind">${escapeHtml(item.type.replaceAll("_", " "))} · důležitost ${item.importance}</span>
    <h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.text)}</p>
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
applyFilters();
