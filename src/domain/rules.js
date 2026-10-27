const TYPES = {
  BIG_WIN: "BIG_WIN",
  EARLY_GOAL: "EARLY_GOAL",
  MULTIPOINT_GAME: "MULTIPOINT_GAME",
  HATTRICK: "HATTRICK",
  BIG_SAVES: "BIG_SAVES",
  TEAM_GOAL_MILESTONE: "TEAM_GOAL_MILESTONE",
  COMEBACK_WIN: "COMEBACK_WIN",
};

function priklep(game, type, subject, importance, title, text, facts, idSuffix = "") {
  const subjectId = subject.playerId ?? subject.teamId ?? "game";
  return {
    id: `${game.gameId}:${type}:${subjectId}${idSuffix ? `:${idSuffix}` : ""}`,
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
      `Výhra o ${scoreDifference} gólů`,
      `${winner.teamName} zvítězilo rozdílem ${scoreDifference} branek.`,
      { scoreDifference, goalsFor: winner.goals, goalsAgainst: winner.goalsAgainst },
    ));
  }

  // When the official score overwrites the event score (forfeit/correction),
  // event-level achievements are not reliable enough for public celebration.
  const reliableGoals = game.scoreWasOverridden ? [] : game.goals;
  const reliablePlayerStats = game.scoreWasOverridden ? [] : game.playerStats;
  const reliableGoalieStats = game.scoreWasOverridden ? [] : game.goalieStats;

  for (const team of game.teamStats) {
    const teamGoals = reliableGoals.filter((goal) => goal.teamId === team.teamId);
    for (let milestone = 10; milestone <= teamGoals.length; milestone += 10) {
      const goal = teamGoals[milestone - 1];
      const scorer = goal.playerId ? goal.playerName : team.teamName;
      result.push(priklep(
        game,
        TYPES.TEAM_GOAL_MILESTONE,
        { playerId: goal.playerId, teamId: team.teamId },
        88 + Math.min(milestone / 10, 5),
        `${milestone}. gól týmu`,
        goal.playerId
          ? `${scorer} vstřelil ${milestone}. gól týmu ${team.teamName} v zápase.`
          : `${team.teamName} vstřelil svůj ${milestone}. gól v zápase.`,
        { milestone, gameTime: goal.gameTime },
        milestone,
      ));
    }
  }

  if (reliableGoals.length && reliableGoals.every((goal) => goal.elapsedSeconds !== null)) {
    const winner = home.goals > away.goals ? home : away.goals > home.goals ? away : null;
    if (winner) {
      const score = new Map(game.teamStats.map((team) => [team.teamId, 0]));
      let largestDeficit = 0;
      for (const goal of reliableGoals) {
        score.set(goal.teamId, (score.get(goal.teamId) ?? 0) + 1);
        const opponent = game.teamStats.find((team) => team.teamId !== winner.teamId);
        largestDeficit = Math.max(largestDeficit, (score.get(opponent.teamId) ?? 0) - (score.get(winner.teamId) ?? 0));
      }
      if (largestDeficit >= 4) {
        result.push(priklep(
          game,
          TYPES.COMEBACK_WIN,
          { teamId: winner.teamId },
          96,
          `Obrat ze ztráty ${largestDeficit} gólů`,
          `${winner.teamName} prohrával o ${largestDeficit} góly, ale zápas otočil a zvítězil ${winner.goals}:${winner.goalsAgainst}.`,
          { largestDeficit, goalsFor: winner.goals, goalsAgainst: winner.goalsAgainst },
        ));
      }
    }
  }

  for (const goal of reliableGoals.filter((item) => item.elapsedSeconds !== null && item.elapsedSeconds <= 60)) {
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

  for (const player of reliablePlayerStats.filter((item) => item.points >= 3)) {
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

  for (const player of reliablePlayerStats.filter((item) => item.goals >= 3)) {
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

  for (const goalie of reliableGoalieStats.filter((item) => item.saves >= 30)) {
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

