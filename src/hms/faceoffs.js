import { selectEventGroup, uniqueEvents } from './event-snapshot.js';

const count = (value) => value !== null && value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const id = (value) => typeof value === 'string' ? value.toLowerCase() : null;

// Keep team totals only, never the raw public/primary response. Official HMS
// totals can include quick faceoffs that are absent from the public event list.
export function faceoffSnapshot(response, detail, metadata, game, players) {
  const publicMatches = metadata && count(metadata.HomeTeamGoals) === game.homeScore && count(metadata.AwayTeamGoals) === game.awayScore
    && (!metadata.homeTeamId || id(metadata.homeTeamId) === id(game.homeTeamId))
    && (!metadata.awayTeamId || id(metadata.awayTeamId) === id(game.awayTeamId));
  for (const [data, source] of [[detail, 'hms-totals'], [response, 'hms-totals'], [publicMatches ? metadata : null, 'hms-public-totals']]) {
    const homeWins = count(data?.HomeTeamFaceOffs);
    const awayWins = count(data?.AwayTeamFaceOffs);
    if (homeWins !== null && awayWins !== null) return { homeWins, awayWins, unattributed: 0, source };
  }
  const group = selectEventGroup(response, detail, 'GameEventFaceOffs', 'faceoff');
  if (!group.available) return null;
  const result = { homeWins: 0, awayWins: 0, unattributed: 0, source: 'recorded-events' };
  for (const event of uniqueEvents(group.events, 'faceOff').filter((item) => !item.isDeleted)) {
    const winner = id(event.wonByTeamId ?? event.WonByTeam?.teamId ?? players.get(event.wonByPlayerId ?? event.WonByPlayer?.playerId)?.teamId);
    if (winner && winner === id(game.homeTeamId)) result.homeWins++;
    else if (winner && winner === id(game.awayTeamId)) result.awayWins++;
    else result.unattributed++;
  }
  return result;
}
