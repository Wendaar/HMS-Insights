const SEASON_TYPES = Object.freeze({
  SEASON_GOAL_MILESTONE: "SEASON_GOAL_MILESTONE",
  SEASON_POINT_MILESTONE: "SEASON_POINT_MILESTONE",
  TEAM_WIN_STREAK: "TEAM_WIN_STREAK",
  TEAM_UNBEATEN_STREAK: "TEAM_UNBEATEN_STREAK",
  PLAYER_GOAL_STREAK: "PLAYER_GOAL_STREAK",
});

function orderRows(rows) {
  return [...rows].sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)) || a.gameId.localeCompare(b.gameId));
}

function groupsOf(rows, keyFor) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups.values();
}

function crossedMilestones(before, after, step = 10) {
  const result = [];
  for (let milestone = Math.floor(before / step) * step + step; milestone <= after; milestone += step) {
    result.push(milestone);
  }
  return result;
}

function seasonPriklep(row, type, subject, importance, title, text, facts, key) {
  return {
    id: `${row.gameId}:${type}:${subject.playerId ?? subject.teamId}:${key}`,
    organizationId: row.organizationId,
    competitionId: row.competitionId,
    seasonId: row.seasonId,
    groupId: row.groupId,
    gameId: row.gameId,
    type,
    playerId: subject.playerId ?? null,
    teamId: subject.teamId ?? null,
    importance,
    title,
    text,
    facts,
  };
}

function playerMilestones(playerRows) {
  const result = [];
  for (const rows of groupsOf(playerRows, (row) => row.playerId)) {
    let goals = 0;
    let points = 0;
    for (const row of orderRows(rows)) {
      const nextGoals = goals + row.goals;
      const nextPoints = points + row.goals + row.assists;
      for (const milestone of crossedMilestones(goals, nextGoals)) {
        result.push(seasonPriklep(
          row,
          SEASON_TYPES.SEASON_GOAL_MILESTONE,
          row,
          Math.min(88 + milestone / 10, 97),
          `${milestone}. gól v sezoně`,
          `${row.playerName} vstřelil svůj ${milestone}. gól v sezoně.`,
          { milestone, goalsInGame: row.goals, seasonGoals: nextGoals },
          milestone,
        ));
      }
      for (const milestone of crossedMilestones(points, nextPoints)) {
        result.push(seasonPriklep(
          row,
          SEASON_TYPES.SEASON_POINT_MILESTONE,
          row,
          Math.min(84 + milestone / 10, 94),
          `${milestone}. bod v sezoně`,
          `${row.playerName} získal svůj ${milestone}. bod v sezoně.`,
          { milestone, pointsInGame: row.goals + row.assists, seasonPoints: nextPoints },
          milestone,
        ));
      }
      goals = nextGoals;
      points = nextPoints;
    }
  }
  return result;
}

function playerGoalStreaks(playerRows) {
  const result = [];
  for (const rows of groupsOf(playerRows, (row) => `${row.groupId}:${row.playerId}`)) {
    let streak = 0;
    for (const row of orderRows(rows)) {
      streak = row.goals > 0 ? streak + 1 : 0;
      if (streak < 4) continue;
      result.push(seasonPriklep(
        row,
        SEASON_TYPES.PLAYER_GOAL_STREAK,
        row,
        Math.min(89 + streak, 97),
        `${streak} zápasy s gólem`,
        `${row.playerName} skóroval v ${streak} zápasech za sebou.`,
        { streak, goalsInGame: row.goals },
        streak,
      ));
    }
  }
  return result;
}

function teamStreaks(teamRows) {
  const result = [];
  for (const rows of groupsOf(teamRows, (row) => `${row.groupId}:${row.teamId}`)) {
    let wins = 0;
    let unbeaten = 0;
    for (const row of orderRows(rows)) {
      wins = row.result === "WIN" ? wins + 1 : 0;
      unbeaten = row.result === "LOSS" ? 0 : unbeaten + 1;
      if (wins >= 4) {
        result.push(seasonPriklep(
          row,
          SEASON_TYPES.TEAM_WIN_STREAK,
          row,
          Math.min(86 + wins, 96),
          `${wins} výhry v řadě`,
          `${row.teamName} vyhrál ${wins} zápasů za sebou.`,
          { streak: wins },
          wins,
        ));
      } else if (unbeaten >= 5) {
        result.push(seasonPriklep(
          row,
          SEASON_TYPES.TEAM_UNBEATEN_STREAK,
          row,
          Math.min(82 + unbeaten, 94),
          `${unbeaten} zápasů bez porážky`,
          `${row.teamName} neprohrál už ${unbeaten} zápasů v řadě.`,
          { streak: unbeaten },
          unbeaten,
        ));
      }
    }
  }
  return result;
}

export function detectSeasonPriklepy({ playerRows = [], teamRows = [] }) {
  return [
    ...playerMilestones(playerRows),
    ...playerGoalStreaks(playerRows),
    ...teamStreaks(teamRows),
  ].sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
}

export { SEASON_TYPES, crossedMilestones };
