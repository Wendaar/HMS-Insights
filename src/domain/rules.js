const TYPES = {
  BIG_WIN: "BIG_WIN",
  EARLY_GOAL: "EARLY_GOAL",
  MULTIPOINT_GAME: "MULTIPOINT_GAME",
  HATTRICK: "HATTRICK",
  BIG_SAVES: "BIG_SAVES",
};

function priklep(game, type, subject, importance, title, text, facts) {
  const subjectId = subject.playerId ?? subject.teamId ?? "game";
  return {
    id: `${game.gameId}:${type}:${subjectId}`,
    organizationId: game.organizationId,
    competitionId: game.competitionId,
    seasonId: game.seasonId,
    groupId: game.groupId,
    gameId: game.gameId,
    type,
    playerId: subject.playerId ?? null,
    teamId: subject.teamId ?? null,
    importance,
    title,
    text,
    facts,
  };
}

export function detectPriklepy(game) {
  const result = [];
  const [home, away] = game.teamStats;
  const scoreDifference = Math.abs(home.goals - away.goals);

  if (scoreDifference >= 6) {
    const winner = home.goals > away.goals ? home : away;
    result.push(priklep(
      game,
      TYPES.BIG_WIN,
      { teamId: winner.teamId },
      90,
      "Výhra o šest",
      `${winner.teamName} zvítězilo rozdílem ${scoreDifference} branek.`,
      { scoreDifference, goalsFor: winner.goals, goalsAgainst: winner.goalsAgainst },
    ));
  }

  for (const goal of game.goals.filter((item) => item.elapsedSeconds <= 60)) {
    result.push(priklep(
      game,
      TYPES.EARLY_GOAL,
      { playerId: goal.playerId, teamId: goal.teamId },
      86,
      "Rychlý zásah",
      `${goal.playerName} skóroval už v čase ${goal.gameTime}.`,
      { gameTime: goal.gameTime, elapsedSeconds: goal.elapsedSeconds },
    ));
  }

  for (const player of game.playerStats.filter((item) => item.points >= 3)) {
    result.push(priklep(
      game,
      TYPES.MULTIPOINT_GAME,
      player,
      player.points >= 4 ? 78 : 66,
      `${player.points} body v zápase`,
      `${player.playerName} zaznamenal ${player.points} body (${player.goals}+${player.assists}).`,
      { goals: player.goals, assists: player.assists, points: player.points },
    ));
  }

  for (const player of game.playerStats.filter((item) => item.goals >= 3)) {
    result.push(priklep(
      game,
      TYPES.HATTRICK,
      player,
      92,
      "Hattrick",
      `${player.playerName} vstřelil ${player.goals} góly.`,
      { goals: player.goals },
    ));
  }

  for (const goalie of game.goalieStats.filter((item) => item.saves >= 30)) {
    result.push(priklep(
      game,
      TYPES.BIG_SAVES,
      goalie,
      72,
      `${goalie.saves} zákroků`,
      `${goalie.playerName} zaznamenal ${goalie.saves} zákroků.`,
      { saves: goalie.saves, goalsAgainst: goalie.goalsAgainst },
    ));
  }

  return result.sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
}

export { TYPES };

