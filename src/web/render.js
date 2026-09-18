const labels = {
  BIG_WIN: "BIG WIN",
  EARLY_GOAL: "EARLY GOAL",
  MULTIPOINT_GAME: "MULTIPOINT",
  HATTRICK: "HATTRICK",
  BIG_SAVES: "BIG SAVES",
};

const icons = {
  BIG_WIN: "✦",
  EARLY_GOAL: "↗",
  MULTIPOINT_GAME: "+",
  HATTRICK: "×3",
  BIG_SAVES: "◆",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

export function renderPriklepyPage({ game, priklepy }) {
  const home = game.teamStats.find((team) => team.side === "HOME");
  const away = game.teamStats.find((team) => team.side === "AWAY");
  const cards = priklepy.map((item, index) => `
    <article class="card type-${item.type.toLowerCase()}" style="--delay:${index * 45}ms">
      <div class="card-mark" aria-hidden="true">${icons[item.type]}</div>
      <div class="card-copy">
        <div class="card-meta"><span>${labels[item.type]}</span><span>síla ${item.importance}</span></div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.text)}</p>
      </div>
    </article>`).join("");

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Příklepy z dokončeného zápasu HMS">
  <title>Příklepy · ${escapeHtml(home.teamName)} vs ${escapeHtml(away.teamName)}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main>
    <header class="topbar">
      <a class="brand" href="/priklepy" aria-label="HMS Insights – Příklepy"><span>HMS</span> PŘÍKLEPY</a>
      <span class="status"><i></i> dokončeno</span>
    </header>

    <section class="scoreboard" aria-labelledby="match-title">
      <div class="context">
        <span>${escapeHtml(game.competitionName)}</span>
        <span>${escapeHtml(game.groupName)}</span>
        <span>${new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(`${game.playedOn}T12:00:00`))}</span>
      </div>
      <div class="scoreline" id="match-title">
        <div class="team home"><span class="side">domácí</span><strong>${escapeHtml(home.teamName)}</strong></div>
        <div class="score" aria-label="Výsledek ${game.homeScore} ku ${game.awayScore}"><b>${game.homeScore}</b><em>:</em><b>${game.awayScore}</b></div>
        <div class="team away"><span class="side">hosté</span><strong>${escapeHtml(away.teamName)}</strong></div>
      </div>
      <div class="summary">
        <span><b>${priklepy.length}</b> nalezených momentů</span>
        <span><b>${game.goals[0].gameTime}</b> první gól</span>
        <span><b>${Math.max(...game.goalieStats.map((item) => item.saves))}</b> nejvíce zákroků</span>
      </div>
    </section>

    <section class="feed" aria-labelledby="feed-title">
      <div class="section-heading"><p>Automaticky z Game Events + Lineup</p><h1 id="feed-title">Co v zápase udeřilo</h1></div>
      <div class="cards">${cards}</div>
    </section>
  </main>
</body>
</html>`;
}

