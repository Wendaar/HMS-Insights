import {hmsMediaContext} from './media-context.js';
import { buildEventSnapshot, selectEventGroup, uniqueEvents } from "./event-snapshot.js";
import { enrichEventGroups } from "./public-event-metadata.js";
import { faceoffSnapshot } from './faceoffs.js';
import { flickrAlbum } from '../../public/game-report-media.js';
import {jerseyColor} from '../../public/game-report-graphics.js';

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

function optionalSecondsFromClock(clock) {
  if (clock === undefined || clock === null || clock === "") return null;
  return secondsFromClock(clock);
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
    primaryColor: team.jerseyColor1 || team.teamColor1 || null,
    secondaryColor: team.jerseyColor2 || team.teamColor2 || null,
  };
}

function teamFromEvent(event) {
  const team = event.ScoredByTeam ?? event.SavedByTeam ?? event.PenalizedTeam;
  return teamRecord(team);
}

function eventGroups(response, detail) {
  return {
    goals: selectEventGroup(response, detail, "GameEventGoals", "goal"),
    saves: selectEventGroup(response, detail, "GameEventSaves", "save"),
    penalties: selectEventGroup(response, detail, "GameEventPenalties", "penalty"),
  };
}

function lineupRows(response) {
  if (Array.isArray(response)) return response;
  return response?.Lineups ?? [];
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function penaltyMinutes(value) {
  if (value === undefined || value === null || value === "") return 0;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;

  const parts = String(value).split(":").map(Number);
  if (parts.length >= 2 && parts.length <= 3 && parts.every(Number.isFinite)) {
    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
    if (minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60 && hours >= 0) {
      const totalMinutes = hours * 60 + minutes + seconds / 60;
      return Math.round(totalMinutes * 1_000_000) / 1_000_000;
    }
  }
  throw new Error(`Neplatná délka trestu: ${value}`);
}

export function normalizeHmsGame(gameEventsResponse, lineupResponse, gameDetailResponse = null, publicMetadata = null, options = {}) {
  if (gameDetailResponse?.gameId && gameEventsResponse?.gameId
    && gameDetailResponse.gameId.toLowerCase() !== gameEventsResponse.gameId.toLowerCase()) {
    throw new Error("Game Detail a Events patří k různým zápasům.");
  }
  const groupedEvents = eventGroups(gameEventsResponse, gameDetailResponse);
  for (const [group, type] of [["goals", "goal"], ["saves", "save"], ["penalties", "penalty"]]) {
    groupedEvents[group].events = uniqueEvents(groupedEvents[group].events, type);
  }
  const gameResponse = {
    ...gameEventsResponse, ...gameDetailResponse,
    GameEventGoals: groupedEvents.goals.events,
    GameEventSaves: groupedEvents.saves.events,
    GameEventPenalties: groupedEvents.penalties.events,
  };
  enrichEventGroups(groupedEvents, publicMetadata, gameResponse);
  const gameId = required(gameResponse.gameId, "gameId");
  // The gameLineup endpoint is already scoped by the gameId query parameter and
  // does not have to repeat that id in its response body. Compare it only when
  // HMS includes it; a present, different id is still rejected.
  const lineupGameIds = Array.isArray(lineupResponse)
    ? lineupResponse.map((item) => item.gameId).filter(Boolean)
    : [lineupResponse.gameId].filter(Boolean);
  if (lineupGameIds.some((lineupGameId) => lineupGameId.toLowerCase() !== gameId.toLowerCase())) {
    throw new Error("Game Events a Lineup patří k různým zápasům.");
  }
  if (!options.allowUnfinished && gameResponse.status !== "FINISHED") throw new Error("MVP přijímá pouze dokončený zápas.");

  const phase = required(gameResponse.Phase ?? lineupResponse.Phase, "Phase");
  const group = required(gameResponse.Group ?? phase.Group, "Group");
  const season = required(gameResponse.Season ?? group.Season, "Season");
  const competition = required(gameResponse.Competition ?? season.Competition, "Competition");
  const lineups = lineupRows(lineupResponse).filter((item) => !item.isDeleted);
  const goalieIds = new Set([
    ...(gameResponse.GameEventSaves ?? []).map((item) => item.savedByPlayerId),
    ...(gameResponse.GameEventGoals ?? []).map((item) => item.allowedByPlayerId),
  ].filter(Boolean));

  const players = new Map(lineups.map((item) => [item.playerId, {
    playerId: item.playerId,
    playerName: playerName(item.Player, item.name),
    teamId: item.teamId,
    number: item.number ?? null,
    position: /^(O|D)$/.test(item.ListPosition?.short??'')?'D':/^(Ú|U|F)$/.test(item.ListPosition?.short??'')?'F':null,
    isGoalie: item.ListPosition?.isGoalie === true || goalieIds.has(item.playerId),
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
    if (team) {
      const known=teamMap.get(team.teamId);
      teamMap.set(team.teamId,Object.fromEntries(Object.keys(team).map(key=>[key,team[key]??known?.[key]??null])));
    }
  }

  const playerStats = new Map([...players.values()]
    .filter((item) => !item.isGoalie)
    .map((item) => [item.playerId, { ...item, goals: 0, assists: 0, points: 0, pim: 0 }]));

  const goals = (gameResponse.GameEventGoals ?? [])
    .filter((item) => !item.isDeleted)
    .map((item) => ({
      eventId: item.gameEventGoalId ?? item.eventId,
      gameTime: item.gameTime ?? null,
      // A manually entered quick goal can legitimately have no clock value.
      // It still counts, but cannot be used for time-based achievements.
      elapsedSeconds: optionalSecondsFromClock(item.gameTime),
      period: item.period,
      playerId: item.scoredByPlayerId ?? item.ScoredByPlayer?.playerId ?? null,
      playerName: playerName(
        item.ScoredByPlayer,
        players.get(item.scoredByPlayerId ?? item.ScoredByPlayer?.playerId)?.playerName,
      ),
      teamId: item.scoredByTeamId ?? item.ScoredByTeam?.teamId,
      assistedByPlayerIds: [item.assistedBy1PlayerId, item.assistedBy2PlayerId].filter(Boolean),
      allowedByPlayerId: item.allowedByPlayerId ?? item.AllowedByPlayer?.playerId ?? null,
    }))
    .sort((a, b) => (a.elapsedSeconds ?? Number.POSITIVE_INFINITY)
      - (b.elapsedSeconds ?? Number.POSITIVE_INFINITY));

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
    if (player) player.pim += penaltyMinutes(penalty.duration);
  }
  for (const stat of playerStats.values()) stat.points = stat.goals + stat.assists;

  const saveCounts = new Map();
  for (const save of (gameResponse.GameEventSaves ?? []).filter((item) => !item.isDeleted)) {
    const savedByPlayerId = save.savedByPlayerId ?? save.SavedByPlayer?.playerId ?? null;
    // Quick SAVE may not identify a goalie. Do not invent one and do not let
    // an unattributable event prevent the whole game from being imported.
    if (!savedByPlayerId) continue;
    const existing = saveCounts.get(savedByPlayerId) ?? {
      playerId: savedByPlayerId,
      playerName: playerName(save.SavedByPlayer, players.get(savedByPlayerId)?.playerName),
      teamId: save.savedByTeamId ?? save.SavedByTeam?.teamId ?? players.get(savedByPlayerId)?.teamId,
      playerImageUrl: players.get(savedByPlayerId)?.playerImageUrl ?? save.SavedByPlayer?.avatarUrl ?? null,
      saves: 0,
      goalsAgainst: 0,
    };
    existing.saves += 1;
    saveCounts.set(existing.playerId, existing);
  }
  for (const goal of goals) {
    if (!goal.allowedByPlayerId) continue;
    const keeper = players.get(goal.allowedByPlayerId);
    const existing = saveCounts.get(goal.allowedByPlayerId) ?? {
      playerId: goal.allowedByPlayerId, playerName: keeper?.playerName ?? 'Neznámý hráč',
      teamId: keeper?.teamId ?? null, playerImageUrl: keeper?.playerImageUrl ?? null, saves: 0, goalsAgainst: 0,
    };
    existing.goalsAgainst++;
    saveCounts.set(goal.allowedByPlayerId, existing);
  }

  const homeTeamId = gameResponse.homeTeamId ?? gameResponse.HomeTeam?.teamId;
  const awayTeamId = gameResponse.awayTeamId ?? gameResponse.AwayTeam?.teamId;
  const teamIds = [homeTeamId, awayTeamId];
  const eventScores = teamIds.map((teamId) => goals.filter((goal) => goal.teamId === teamId).length);
  const officialHomeScore = optionalNumber(gameResponse.HomeTeamGoals);
  const officialAwayScore = optionalNumber(gameResponse.AwayTeamGoals);
  const officialScores = [officialHomeScore, officialAwayScore];
  const scoreWasOverridden = officialScores.some((score, index) => score !== null && score !== eventScores[index]);

  const teamStats = teamIds.map((teamId, index) => {
    const opponentId = teamIds.find((id) => id !== teamId);
    const opponentIndex = teamIds.indexOf(opponentId);
    // The game detail is the source of truth for an administrative/overwrite
    // result. Event-derived scores remain useful only when no official value
    // is available.
    const goalsFor = officialScores[index] ?? eventScores[index];
    const goalsAgainst = officialScores[opponentIndex] ?? eventScores[opponentIndex];
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

  const normalized = {
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
    scoreWasOverridden,
    players: [...players.values()],
    goals,
    playerStats: [...playerStats.values()],
    goalieStats: [...saveCounts.values()],
    teamStats,
  };
  normalized.eventSnapshot = buildEventSnapshot(normalized, groupedEvents, players, penaltyMinutes);
  normalized.eventSnapshot.branding=hmsMediaContext({Phase:phase,Group:group,Season:season,Competition:competition,Organization:gameResponse.Organization});
  normalized.eventSnapshot.faceoffs = faceoffSnapshot(gameEventsResponse, gameDetailResponse, publicMetadata, normalized, players);
  normalized.eventSnapshot.roster=[...players.values()].map(p=>({id:p.playerId,teamId:p.teamId,isGoalie:p.isGoalie,...(p.position?{position:p.position}:{})}));
  normalized.eventSnapshot.jerseyColors={home:jerseyColor(gameResponse.homeJerseyColor),away:jerseyColor(gameResponse.awayJerseyColor)};
  normalized.eventSnapshot.media = { albumUrl: flickrAlbum(gameResponse.flickrAlbum)
    ?? (publicMetadata?.gameId?.toLowerCase()===gameId.toLowerCase()?flickrAlbum(publicMetadata.flickrAlbum):null) };
  return normalized;
}

export { penaltyMinutes, resolveHmsMediaUrl, secondsFromClock };
