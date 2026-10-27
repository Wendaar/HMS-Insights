import { fetchGameDetail, fetchGames, hmsConfigFromEnv } from "../hms/client.js";
import { gameRows } from "./backfill-finished-games.js";
import { broadcastScope } from "./broadcast-context.js";
import { readOfficialStandings } from "./broadcast-league.js";
import { organizationConfig } from "./organizations.js";
import { savePregameRankings } from "../infrastructure/postgres-repository.js";
import { isGameId } from "../domain/game-summary.js";

const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const ineligible = new Set(["CANCELLED", "CANCELED", "POSTPONED", "FINISHED", "RUNNING"]);

export function pragueDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

async function mapLimited(items, limit, fn) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await fn(items[index]);
    }
  }));
  return result;
}

export async function capturePregameRankings(org = "PHM", options = {}) {
  const env = options.env ?? process.env;
  const config = organizationConfig(org, env);
  if (!config.token) throw new Error("Organizace nemá HMS API token.");
  const date = options.date ?? pragueDate(options.now);
  const hmsConfig = { ...hmsConfigFromEnv({ ...env, HMS_API_TOKEN: config.token }), timeoutMs: 7000, retries: 1 };
  const payload = await (options.fetchGames ?? fetchGames)({ from: date, to: date, status: "ALL", limit: 100, skip: 0 }, { config: hmsConfig });
  const listed = gameRows(payload);
  if (listed.length > 100) throw new Error("Příliš mnoho zápasů pro jeden den.");
  // A late/manual run must never turn a post-game table into a fictional
  // pre-game snapshot. Only fixtures that have not started are eligible.
  const candidates = listed.filter((game) => !ineligible.has(String(game.status).toUpperCase()));
  if (candidates.some((game) => !same(game.organizationId, config.id) || game.startDate !== date)) throw new Error("HMS vrátilo jiný rozsah zápasů.");

  const detailResults = await mapLimited(candidates, 3, async (game) => {
    try {
      const detail = await (options.fetchDetail ?? fetchGameDetail)(game.gameId, { config: hmsConfig });
      if (!same(detail.organizationId, config.id) || !same(detail.gameId, game.gameId) || detail.startDate !== date) throw new Error("HMS vrátilo jiný zápas.");
      return ineligible.has(String(detail.status).toUpperCase()) ? null : detail;
    } catch { return null; }
  });
  const details = detailResults.filter(Boolean);

  const tables = new Map();
  const rows = [];
  let unavailable = candidates.length - details.length;
  for (const detail of details) {
    const scope = broadcastScope(detail);
    const scopeKey = scope.phaseId ? `phase:${scope.phaseId}` : scope.groupId ? `group:${scope.groupId}` : null;
    if (!scopeKey || ![scope.organizationId, scope.competitionId, scope.seasonId].every(isGameId)) { unavailable++; continue; }
    if (!tables.has(scopeKey)) tables.set(scopeKey, Promise.resolve((options.readStandings ?? readOfficialStandings)(scope, options)));
    let standings;
    try { standings = await tables.get(scopeKey); } catch { unavailable++; continue; }
    const homeTeamId = detail.homeTeamId ?? detail.HomeTeam?.teamId;
    const awayTeamId = detail.awayTeamId ?? detail.AwayTeam?.teamId;
    if (!isGameId(homeTeamId) || !isGameId(awayTeamId) || same(homeTeamId, awayTeamId)) { unavailable++; continue; }
    const home = standings.find((team) => same(team.id, homeTeamId));
    const away = standings.find((team) => same(team.id, awayTeamId));
    if (!home || !away) { unavailable++; continue; }
    rows.push({
      gameId: detail.gameId, organizationId: config.id, competitionId: scope.competitionId,
      seasonId: scope.seasonId, groupId: scope.groupId, phaseId: scope.phaseId,
      scheduledOn: detail.startDate, scheduledTime: detail.startTime ?? null,
      homeTeamId, awayTeamId, homeRank: home.rank, awayRank: away.rank,
      homePoints: home.points, awayPoints: away.points, homeGames: home.games, awayGames: away.games,
      capturedAt: (options.now ?? new Date()).toISOString(),
    });
  }
  const saved = await (options.save ?? savePregameRankings)(rows, { env });
  return { organization: config.code, date, games: candidates.length, saved, alreadyCaptured: rows.length - saved, unavailable };
}
