import test from 'node:test';
import assert from 'node:assert/strict';
import {operationsLoad, commitOperationsPage, continueOperationsLoad} from '../public/operations/loading.js';
import {readOperations} from '../src/app/operations.js';
import {readPublicGameDay, ScheduleSourceError} from '../src/app/season-games.js';
import {createOperationsHandler} from '../src/web/operations-handler.js';
import {HmsRequestError} from '../src/hms/client.js';
const org = 'bb669217-41eb-4162-8040-a73f49a43570', season = '99999999-1111-4111-8111-111111111111';
const id = n => String(n).padStart(8, '0') + '-1111-4111-8111-111111111111';
const range = {from: '2026-10-01', to: '2026-10-31'};
const page = (offset, ids, hasMore) => ({organizationSlug: 'phm', offset, nextOffset: offset + ids.length, games: ids.map(id => ({id})), hasMore, complete: !hasMore});
const env = {HMS_API_TOKEN: 'api-secret', HMS_PHM_OPERATIONS_SECRET: 'viewer-secret'};
const query = {org: 'phm', ...range};
const game = n => ({gameId: id(n), organizationId: org, seasonId: season, startDate: '2026-10-01', startTime: '18:00', homeTeamId: id(100), awayTeamId: id(101), status: 'FINISHED', Competition: {name: 'PHM Cup'}});
const metadata = n => ({gameId: id(n), startDate: '2026-10-01', HomeTeam: {teamId: id(100), name: 'Home'}, AwayTeam: {teamId: id(101), name: 'Away'}, Venue: {name: 'Icerink'}, referee: 'Ref A; Ref B', timekeeper: 'Timer', Phase: {Group: {Season: {seasonId: season, Competition: {name: 'PHM Cup'}}}}});
test('a failed later page resumes from its cursor without refetching or double-counting earlier pages', async () => {
  const state = operationsLoad('phm', range), cursors = [];
  await assert.rejects(continueOperationsLoad(state, {readPage: async offset => {cursors.push(offset); if (offset === 0) return page(0, [id(1), id(2)], true); throw Error('temporary');}}));
  assert.equal(state.complete, false); assert.equal(state.games.length, 2); assert.equal(state.offset, 2);
  await continueOperationsLoad(state, {readPage: async offset => {cursors.push(offset); return page(offset, [id(3)], false);}});
  assert.deepEqual(cursors, [0, 2, 2]); assert.equal(state.games.length, 3); assert.equal(state.complete, true);
});
test('transient failures retry the same page while validation failures never auto-retry', async () => {
  const state = operationsLoad('phm', range), delays = []; let reads = 0;
  await continueOperationsLoad(state, {readPage: async () => {if (++reads < 3) {const e = Error('rate'); e.retryable = true; e.retryAfter = 2; throw e;} return page(0, [id(1)], false);}, pause: async delay => delays.push(delay)});
  assert.deepEqual(delays, [2000, 2000]); assert.equal(state.games.length, 1);
  let invalidReads = 0; await assert.rejects(continueOperationsLoad(operationsLoad('phm', range), {readPage: async () => {invalidReads++; throw Error('invalid scope');}})); assert.equal(invalidReads, 1);
});
test('a page is atomic: a duplicate in its last row cannot corrupt the saved buffer', () => {
  const state = operationsLoad('phm', range); commitOperationsPage(state, page(0, [id(1)], true));
  assert.throws(() => commitOperationsPage(state, page(1, [id(2), id(1)], false)));
  assert.deepEqual(state.games.map(game => game.id), [id(1)]); assert.equal(state.offset, 1); assert.equal(state.ids.has(id(2)), false);
});
test('switching organization or range cancels commit of an in-flight page', async () => {
  const state = operationsLoad('phm', range); let active = true;
  const done = await continueOperationsLoad(state, {current: () => active, readPage: async () => {active = false; return page(0, [id(1)], false);}});
  assert.equal(done, false); assert.equal(state.games.length, 0); assert.equal(state.complete, false);
});
test('day-sized enrichment replaces twenty individual game-detail requests with one day request', async () => {
  let days = 0, details = 0;
  const rows = Array.from({length: 20}, (_, i) => game(i + 1));
  const result = await readOperations(query, {env, fetchGames: async () => rows, fetchSchedule: async () => {days++; return rows.map((_, i) => metadata(i + 1));}, fetchDetail: async () => {details++; throw Error('unexpected detail request');}});
  assert.equal(days, 1); assert.equal(details, 0); assert.equal(result.games.length, 20); assert.equal(result.games[0].venue, 'Icerink'); assert.deepEqual(result.games[0].referees, ['Ref A', 'Ref B']);
});
test('non-public fixtures fall back individually instead of breaking the whole month', async () => {
  let details = 0;
  const result = await readOperations(query, {env, fetchGames: async () => [game(1)], fetchSchedule: async () => [], fetchDetail: async () => {details++; return {...game(1), HomeTeam: metadata(1).HomeTeam, AwayTeam: metadata(1).AwayTeam, Venue: {name: 'Private venue'}, referee: null, timekeeper: null};}, fetchMetadata: async () => null});
  assert.equal(details, 1); assert.equal(result.games[0].venue, 'Private venue');
});
test('bulk enrichment rejects a different season or changed fixture identity', async () => {
  for (const wrong of [{...metadata(1), Phase: {Group: {Season: {seasonId: id(88)}}}}, {...metadata(1), HomeTeam: {teamId: id(200)}}]) await assert.rejects(readOperations(query, {env, fetchGames: async () => [game(1)], fetchSchedule: async () => [wrong]}));
});
test('public day records preserve missing official fields and never receive an HMS token', async () => {
  const raw = metadata(1); delete raw.referee;
  const result = await readPublicGameDay(season, '2026-10-01', {fetchImpl: async (url, options) => {assert.equal(options.headers.authorization, undefined); assert.equal(new URL(url).searchParams.get('seasonId'), season); return {ok: true, headers: new Headers(), json: async () => [raw]};}});
  assert.equal(Object.hasOwn(result[0], 'referee'), false);
});
test('public day transport reports a bounded rate-limit retry delay', async () => {
  await assert.rejects(readPublicGameDay(season, '2026-10-01', {fetchImpl: async () => ({ok: false, status: 429, headers: new Headers({'retry-after': '5'})})}), error => error instanceof ScheduleSourceError && error.status === 429 && error.retryAfter === 5);
});
const response = () => ({headers: {}, setHeader(k, v) {this.headers[k] = v;}, status(code) {this.code = code; return this;}, json(body) {this.body = body;}});
test('network TypeError is retryable upstream failure, not an invalid user query; private errors stay private', async () => {
  const result = response();
  await createOperationsHandler({env, reportFailure: () => {}, read: async () => {throw new TypeError('fetch failed api-secret');}})({method: 'GET', headers: {authorization: 'Bearer viewer-secret'}, query}, result);
  assert.equal(result.code, 503); assert.equal(result.body.retryable, true); assert.doesNotMatch(JSON.stringify(result.body), /api-secret|fetch failed/);
});
test('rate limits remain distinguishable from authentication and broken source identity', async () => {
  for (const [error, status, retryable] of [[new HmsRequestError(429, '/games', 5), 429, true], [Error('Invalid HMS source scope'), 503, false]]) {
    const result = response(); await createOperationsHandler({env, reportFailure: () => {}, read: async () => {throw error;}})({method: 'GET', headers: {authorization: 'Bearer viewer-secret'}, query}, result);
    assert.equal(result.code, status); assert.equal(result.body.retryable, retryable); if (status === 429) assert.equal(result.headers['retry-after'], '5');
  }
});
