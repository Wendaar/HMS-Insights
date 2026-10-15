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

function resolveHmsMediaUrl(url, variant = "cropped_md") {
  if (typeof url !== "string" || !url.trim()) return null;
  return url.replace("[size]", variant);
}

function entityMediaUrl(entity) {
  return entity?.logoUrls?.md
    ?? entity?.imageUrls?.md
    ?? resolveHmsMediaUrl(entity?.logoUrl)
    ?? entity?.avatarUrl
    ?? null;
}

function entityMediaTemplate(entity) {
  return entity?.logoUrl ?? null;
}

function teamRecord(team) {
  if (!team) return null;
  return {
    teamId: team.teamId,
    teamName: team.name,
    logoUrl: entityMediaUrl(team) || team.logo || null,
    logoTemplateUrl: entityMediaTemplate(team),
    primaryColor: team.teamColor1 || team.jerseyColor1 || null,
    secondaryColor: team.teamColor2 || team.jerseyColor2 || null,
  };
}

function teamFromEvent(event) {
  const team = event.ScoredByTeam ?? event.SavedByTeam ?? event.PenalizedTeam;
  return teamRecord(team);
}

export function normalizeHmsGame(gameEventsResponse, lineupResponse, gameDetailResponse = null) {
  const gameResponse = gameDetailResponse
    ? {
        ...gameDetailResponse,
        ...gameEventsResponse,
        GameEventGoals: gameEventsResponse.GameEventGoals ?? gameDetailResponse.GameEventGoals,
        GameEventSaves: gameEventsResponse.GameEventSaves ?? gameDetailResponse.GameEventSaves,
        GameEventPenalties: gameEventsResponse.GameEventPenalties ?? gameDetailResponse.GameEventPenalties,
      }
    : gameEventsResponse;
  const gameId = required(gameResponse.gameId, "gameId");
  // The gameLineup endpoint is already scoped by the gameId query parameter and
  // does not have to repeat that id in its response body. Compare it only when
  // HMS includes it; a present, different id is still rejected.
  if (lineupResponse.gameId && lineupResponse.gameId.toLowerCase() !== gameId.toLowerCase()) {
    throw new Error("Game Events a Lineup patří k různým zápasům.");
  }
  if (gameResponse.status !== "FINISHED") throw new Error("MVP přijímá pouze dokončený zápas.");

  const phase = required(gameResponse.Phase ?? lineupResponse.Phase, "Phase");
  const group = required(gameResponse.Group ?? phase.Group, "Group");
  const season = required(gameResponse.Season ?? group.Season, "Season");
  const competition = required(gameResponse.Competition ?? season.Competition, "Competition");
  const lineups = (lineupResponse.Lineups ?? []).filter((item) => !item.isDeleted);

  const players = new Map(lineups.map((item) => [item.playerId, {
    playerId: item.playerId,
    playerName: playerName(item.Player, item.name),
    teamId: item.teamId,
    number: item.number ?? null,
    isGoalie: item.ListPosition?.isGoalie === true,
    playerImageUrl: entityMediaUrl(item.Player),
    playerImageTemplateUrl: entityMediaTemplate(item.Player),
  }]));

  const allEvents = [
    ...(gameResponse.GameEventGoals ?? []),
    ...(gameResponse.GameEventSaves ?? []),
    ...(gameResponse.GameEventPenalties ?? []),
  ].filter((item) => !item.isDeleted);
  const teamMap = new Map();
  for (const team of [gameResponse.HomeTeam, gameResponse.AwayTeam].map(teamRecord).filter(Boolean)) {
    teamMap.set(team.teamId, team);
  }
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

  const homeTeamId = gameResponse.homeTeamId ?? gameResponse.HomeTeam?.teamId;
  const awayTeamId = gameResponse.awayTeamId ?? gameResponse.AwayTeam?.teamId;
  const teamIds = [homeTeamId, awayTeamId];
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
      side: teamId === homeTeamId ? "HOME" : "AWAY",
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
    groupLogoUrl: entityMediaUrl(group),
    groupLogoTemplateUrl: group.logoUrl || null,
    phaseId: phase.phaseId,
    phaseName: phase.name,
    venueId: gameResponse.Venue?.venueId ?? lineupResponse.Venue?.venueId ?? gameResponse.venueId ?? null,
    venueName: gameResponse.Venue?.name ?? lineupResponse.Venue?.name ?? null,
    venueLogoUrl: entityMediaUrl(gameResponse.Venue ?? lineupResponse.Venue),
    venueLogoTemplateUrl: entityMediaTemplate(gameResponse.Venue ?? lineupResponse.Venue),
    status: gameResponse.status,
    playedOn: gameResponse.startDate,
    startedAt: `${gameResponse.startDate}T${gameResponse.startTime}`,
    homeTeamId,
    awayTeamId,
    homeScore: teamStats[0].goals,
    awayScore: teamStats[1].goals,
    players: [...players.values()],
    goals,
    playerStats: [...playerStats.values()],
    goalieStats: [...saveCounts.values()],
    teamStats,
  };
}

export { resolveHmsMediaUrl, secondsFromClock };
