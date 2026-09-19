function required(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Chybí povinná hodnota: ${label}`);
  }
  return value;
}

function playerName(player, fallback = "Neznámý hráč") {
  return [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim() || fallback;
}

function secondsFromClock(clock) {
  const match = /^(\d+):(\d{2})$/.exec(clock ?? "");
  if (!match) throw new Error(`Neplatný čas události: ${clock}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function teamFromEvent(event) {
  const team = event.ScoredByTeam ?? event.SavedByTeam ?? event.PenalizedTeam;
  return team ? {
    teamId: team.teamId,
    teamName: team.name,
    logoUrl: team.logo || null,
    logoTemplateUrl: team.logoUrl || null,
    primaryColor: team.teamColor1 || team.jerseyColor1 || null,
    secondaryColor: team.teamColor2 || team.jerseyColor2 || null,
  } : null;
}

export function normalizeHmsGame(gameResponse, lineupResponse) {
  const gameId = required(gameResponse.gameId, "gameId");
  if (lineupResponse.gameId !== gameId) throw new Error("Game Events a Lineup patří k různým zápasům.");
  if (gameResponse.status !== "FINISHED") throw new Error("MVP přijímá pouze dokončený zápas.");

  const phase = required(lineupResponse.Phase, "Phase");
  const group = required(phase.Group, "Phase.Group");
  const season = required(group.Season, "Phase.Group.Season");
  const competition = required(season.Competition, "Phase.Group.Season.Competition");
  const lineups = (lineupResponse.Lineups ?? []).filter((item) => !item.isDeleted);

  const players = new Map(lineups.map((item) => [item.playerId, {
    playerId: item.playerId,
    playerName: playerName(item.Player, item.name),
    teamId: item.teamId,
    number: item.number ?? null,
    isGoalie: item.ListPosition?.isGoalie === true,
    playerImageUrl: item.Player?.avatarUrl || null,
    playerImageTemplateUrl: item.Player?.logoUrl || null,
  }]));

  const allEvents = [
    ...(gameResponse.GameEventGoals ?? []),
    ...(gameResponse.GameEventSaves ?? []),
    ...(gameResponse.GameEventPenalties ?? []),
  ].filter((item) => !item.isDeleted);
  const teamMap = new Map();
  for (const event of allEvents) {
    const team = teamFromEvent(event);
    if (team) teamMap.set(team.teamId, team);
  }

  const playerStats = new Map([...players.values()]
    .filter((item) => !item.isGoalie)
    .map((item) => [item.playerId, { ...item, goals: 0, assists: 0, points: 0, pim: 0 }]));

  const goals = (gameResponse.GameEventGoals ?? [])
    .filter((item) => !item.isDeleted)
    .map((item) => ({
      eventId: item.gameEventGoalId,
      gameTime: item.gameTime,
      elapsedSeconds: secondsFromClock(item.gameTime),
      period: item.period,
      playerId: item.scoredByPlayerId,
      playerName: playerName(item.ScoredByPlayer, players.get(item.scoredByPlayerId)?.playerName),
      teamId: item.scoredByTeamId,
      assistedByPlayerIds: [item.assistedBy1PlayerId, item.assistedBy2PlayerId].filter(Boolean),
      allowedByPlayerId: item.allowedByPlayerId ?? null,
    }))
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  for (const goal of goals) {
    const scorer = playerStats.get(goal.playerId);
    if (scorer) scorer.goals += 1;
    for (const assistantId of goal.assistedByPlayerIds) {
      const assistant = playerStats.get(assistantId);
      if (assistant) assistant.assists += 1;
    }
  }

  for (const penalty of (gameResponse.GameEventPenalties ?? []).filter((item) => !item.isDeleted)) {
    const player = playerStats.get(penalty.penalizedPlayerId);
    if (player) player.pim += Number(penalty.duration ?? 0);
  }
  for (const stat of playerStats.values()) stat.points = stat.goals + stat.assists;

  const saveCounts = new Map();
  for (const save of (gameResponse.GameEventSaves ?? []).filter((item) => !item.isDeleted)) {
    const existing = saveCounts.get(save.savedByPlayerId) ?? {
      playerId: save.savedByPlayerId,
      playerName: playerName(save.SavedByPlayer, players.get(save.savedByPlayerId)?.playerName),
      teamId: save.savedByTeamId,
      playerImageUrl: players.get(save.savedByPlayerId)?.playerImageUrl ?? save.SavedByPlayer?.avatarUrl ?? null,
      saves: 0,
      goalsAgainst: 0,
    };
    existing.saves += 1;
    saveCounts.set(existing.playerId, existing);
  }
  for (const goal of goals) {
    if (goal.allowedByPlayerId && saveCounts.has(goal.allowedByPlayerId)) {
      saveCounts.get(goal.allowedByPlayerId).goalsAgainst += 1;
    }
  }

  const teamIds = [gameResponse.homeTeamId, gameResponse.awayTeamId];
  const teamStats = teamIds.map((teamId) => {
    const opponentId = teamIds.find((id) => id !== teamId);
    const goalsFor = goals.filter((goal) => goal.teamId === teamId).length;
    const goalsAgainst = goals.filter((goal) => goal.teamId === opponentId).length;
    return {
      gameId,
      teamId,
      teamName: teamMap.get(teamId)?.teamName ?? teamId,
      logoUrl: teamMap.get(teamId)?.logoUrl ?? null,
      logoTemplateUrl: teamMap.get(teamId)?.logoTemplateUrl ?? null,
      primaryColor: teamMap.get(teamId)?.primaryColor ?? null,
      secondaryColor: teamMap.get(teamId)?.secondaryColor ?? null,
      side: teamId === gameResponse.homeTeamId ? "HOME" : "AWAY",
      goals: goalsFor,
      goalsAgainst,
      scoreDifference: goalsFor - goalsAgainst,
      lineupSize: lineups.filter((item) => item.teamId === teamId).length,
      result: goalsFor > goalsAgainst ? "WIN" : goalsFor < goalsAgainst ? "LOSS" : "DRAW",
    };
  });

  return {
    gameId,
    organizationId: required(gameResponse.organizationId, "organizationId"),
    competitionId: competition.competitionId,
    competitionName: competition.name,
    seasonId: season.seasonId,
    seasonName: season.name,
    groupId: group.groupId,
    groupName: group.name,
    groupColor: group.color || null,
    groupLogoTemplateUrl: group.logoUrl || null,
    phaseId: phase.phaseId,
    phaseName: phase.name,
    venueId: lineupResponse.Venue?.venueId ?? gameResponse.venueId ?? null,
    venueName: lineupResponse.Venue?.name ?? null,
    venueLogoTemplateUrl: lineupResponse.Venue?.logoUrl ?? null,
    status: gameResponse.status,
    playedOn: gameResponse.startDate,
    startedAt: `${gameResponse.startDate}T${gameResponse.startTime}`,
    homeTeamId: gameResponse.homeTeamId,
    awayTeamId: gameResponse.awayTeamId,
    homeScore: teamStats[0].goals,
    awayScore: teamStats[1].goals,
    players: [...players.values()],
    goals,
    playerStats: [...playerStats.values()],
    goalieStats: [...saveCounts.values()],
    teamStats,
  };
}

export { secondsFromClock };
