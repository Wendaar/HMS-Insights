import {organizationConfig} from './organizations.js';
import {fetchGames, fetchGameDetail, fetchPublicGameMetadata, fetchOrganization, fetchTeams, hmsConfigFromEnv} from '../hms/client.js';
import {gameRows} from './backfill-finished-games.js';
import {isGameId} from '../domain/game-summary.js';
import {periods, normalizeGame, dateValid} from '../../public/operations/model.js';

export const OPERATIONS_PAGE_SIZE = 20;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const cache = new Map();
const teamCache = new Map();
async function teamDirectory(org, config, options) {
  if (options.fetchGames && !options.fetchTeams) return {teams: [], status: 'not-loaded'};
  const cached = !options.fetchTeams && teamCache.get(org.id.toLowerCase());
  if (cached?.until > Date.now()) return cached.value;
  try {
    const payload = await (options.fetchTeams ?? fetchTeams)({config});
    const teams = Array.isArray(payload) ? payload : payload?.teams ?? payload?.items ?? payload?.data;
    if (!Array.isArray(teams) || teams.length > 10000) throw new Error('Invalid team directory');
    const ids = new Set();
    for (const team of teams) {
      if (!isGameId(team.teamId) || (team.organizationId && !same(team.organizationId, org.id)) || ids.has(team.teamId.toLowerCase())) throw new Error('Team directory scope mismatch');
      ids.add(team.teamId.toLowerCase());
    }
    const value = {teams, status: 'available'};
    if (!options.fetchTeams) { if (teamCache.size >= 40) teamCache.delete(teamCache.keys().next().value); teamCache.set(org.id.toLowerCase(), {value, until: Date.now() + 300000}); }
    return value;
  } catch (error) {
    if (error.message === 'Team directory scope mismatch') throw error;
    return {teams: [], status: 'unavailable'};
  }
}
function assertGame(game, org, window, expectedId) {
  if (!same(game.organizationId, org.id) || !isGameId(game.gameId) || (expectedId && !same(expectedId, game.gameId)) ||
      !dateValid(game.startDate) || game.startDate < window.from || game.startDate > window.to) throw new Error('Invalid HMS source scope');
  for (const [side, field] of [['HomeTeam', 'homeTeamId'], ['AwayTeam', 'awayTeamId']]) {
    if (Object.hasOwn(game, field) && game[side]?.teamId && !same(game[field], game[side].teamId)) throw new Error('Conflicting team identity');
  }
}
export function enrichOperationsGame(game, metadata) {
  const homeId = game.HomeTeam?.teamId ?? game.homeTeamId, awayId = game.AwayTeam?.teamId ?? game.awayTeamId;
  if (!metadata || metadata.startDate !== game.startDate || !same(homeId, metadata.HomeTeam?.teamId) || !same(awayId, metadata.AwayTeam?.teamId)) return game;
  const result = {...game};
  for (const side of ['HomeTeam', 'AwayTeam']) result[side] = {...metadata[side], ...game[side]};
  for (const field of ['Venue', 'Phase']) result[field] = {...metadata[field], ...game[field]};
  for (const field of ['referee', 'timekeeper']) if (game[field] === undefined) result[field] = metadata[field];
  return result;
}
function financialFields(object, prefix = '', depth = 0) {
  if (!object || typeof object !== 'object' || depth > 4) return [];
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? prefix + '.' + key : key;
    if (/payment|paid|foreign|foreing|external/i.test(key)) {
      const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
      return [{path, type: value === null ? 'null' : typeof value,
        status: ['PAID', 'NOT PAID', 'NOT_PAID', 'UNPAID', 'CASH', 'HOTOVĚ', 'HOTOVE', 'FAKTURY', 'FAKTURA'].includes(text) ? text : 'other'}];
    }
    return value && typeof value === 'object' && !Array.isArray(value) ? financialFields(value, path, depth + 1) : [];
  });
}
export async function readOperations(query, options = {}) {
  const env = options.env ?? process.env, org = organizationConfig(query.org, env);
  const windows = periods(query.from, query.to), window = {from: windows.previous.from, to: windows.next.to};
  const offset = Number(query.offset ?? 0);
  if (Array.isArray(query.offset) || !Number.isSafeInteger(offset) || offset < 0 || offset > 3000 || offset % OPERATIONS_PAGE_SIZE) throw new TypeError('Neplatná stránka.');
  if (!org.token) throw new Error('HMS connection unavailable');
  const rules = JSON.parse(env[`HMS_${org.code}_OPERATIONS_RULES`] || '{}');
  const config = {...hmsConfigFromEnv({...env, HMS_API_TOKEN: org.token}), timeoutMs: 4500, retries: 0, signal: AbortSignal.timeout(23000)};
  const rows = gameRows(await (options.fetchGames ?? fetchGames)({...window, status: 'ALL', limit: OPERATIONS_PAGE_SIZE, skip: offset}, {config}));
  if (rows.length > OPERATIONS_PAGE_SIZE || offset + rows.length > 3000) throw new Error('Range too large');
  const unique = new Set();
  for (const game of rows) {
    assertGame(game, org, window);
    if (unique.has(game.gameId.toLowerCase())) throw new Error('Duplicate source page');
    unique.add(game.gameId.toLowerCase());
  }
  const directory = rows.length ? await teamDirectory(org, config, options) : {teams: [], status: 'not-needed'};
  const byTeam = new Map(directory.teams.map(team => [team.teamId.toLowerCase(), team]));
  if (query.action === 'source-fields') {
    const sample = rows[0];
    if (!sample) return {org: org.code, fields: [], source: 'HMS API'};
    const detail = await (options.fetchDetail ?? fetchGameDetail)(sample.gameId, {config});
    assertGame(detail, org, window, sample.gameId);
    const organization = await (options.fetchOrganization ?? fetchOrganization)({config});
    if (!same(organization.organizationId, org.id)) throw new Error('Organization source mismatch');
    return {org: org.code, gameKeys: Object.keys(sample), detailKeys: Object.keys(detail),
      homeKeys: Object.keys(detail.HomeTeam ?? sample.HomeTeam ?? {}), awayKeys: Object.keys(detail.AwayTeam ?? sample.AwayTeam ?? {}),
      organizationKeys: Object.keys(organization), teamDirectoryStatus: directory.status, teamDirectoryCount: directory.teams.length,
      teamDirectoryKeys: Object.keys(directory.teams[0] ?? {}),
      fields: financialFields({...sample, ...detail}), teamFields: directory.teams.slice(0, 3).flatMap(team => financialFields(team))};
  }
  let cursor = 0;
  const result = new Array(rows.length);
  await Promise.all(Array.from({length: Math.min(3, rows.length)}, async () => {
    while (cursor < rows.length) {
      const index = cursor++, game = rows[index];
      if (game.isDeleted) { result[index] = null; continue; }
      const key = org.id.toLowerCase() + ':' + game.gameId.toLowerCase();
      const cached = !options.fetchGames && cache.get(key);
      if (cached?.until > Date.now()) { result[index] = cached.game; continue; }
      const needsDetail = !game.HomeTeam?.name || !game.AwayTeam?.name || !game.Venue?.name || game.referee === undefined || game.timekeeper === undefined ||
        !['foreignId', 'foreingId', 'externalId'].some(key => Object.hasOwn(game.HomeTeam ?? {}, key));
      let detail = game;
      if (needsDetail) {
        const loaded = await (options.fetchDetail ?? fetchGameDetail)(game.gameId, {config});
        assertGame(loaded, org, window, game.gameId);
        detail = {...game, ...loaded};
        for (const side of ['HomeTeam', 'AwayTeam']) if (game[side] || loaded[side]) detail[side] = {...game[side], ...loaded[side]};
        if (!detail.HomeTeam?.name || !detail.AwayTeam?.name || !detail.Venue?.name || !detail.Phase?.Group?.Season?.Competition?.name) {
          const metadata = await (options.fetchMetadata ?? fetchPublicGameMetadata)(game.gameId, {config});
          detail = enrichOperationsGame(detail, metadata);
        }
      }
      assertGame(detail, org, window, game.gameId);
      for (const [side, idField] of [['HomeTeam', 'homeTeamId'], ['AwayTeam', 'awayTeamId']]) {
        const teamId = detail[side]?.teamId ?? detail[idField];
        const listed = typeof teamId === 'string' ? byTeam.get(teamId.toLowerCase()) : null;
        if (listed) detail[side] = {...detail[side], ...listed};
      }
      const normalized = normalizeGame(detail, rules);
      result[index] = normalized;
      if (!options.fetchGames) {
        if (cache.size >= 4000) cache.delete(cache.keys().next().value);
        cache.set(key, {game: normalized, until: Date.now() + 120000});
      }
    }
  }));
  const games = result.filter(Boolean), hasMore = rows.length === OPERATIONS_PAGE_SIZE;
  return {org: org.code, organizationSlug: org.slug, games, windows, offset, nextOffset: offset + rows.length, hasMore, complete: !hasMore,
    source: 'HMS API', readAt: new Date().toISOString(), timezone: 'Europe/Prague', teamDirectoryStatus: directory.status,
    coverage: {teams: games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.cash !== null).length,
      payments: games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.paid !== null).length,
      staff: games.filter(game => game.referees !== null && game.timekeepers !== null).length},
    mapping: {cash: games.some(game => [game.home, game.away].some(team => team.cash !== null)), paid: games.some(game => [game.home, game.away].some(team => team.paid !== null)), paymentScope: 'team'}
  };
}
