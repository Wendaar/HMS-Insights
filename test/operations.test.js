import test from 'node:test';
import assert from 'node:assert/strict';
import {people, periods, normalizeGame, warnings, aggregate, csv, sidePaid, teamCash, paymentIssues, staffRanking} from '../public/operations/model.js';
import {readOperations, enrichOperationsGame, OPERATIONS_PAGE_SIZE} from '../src/app/operations.js';
import {createOperationsHandler} from '../src/web/operations-handler.js';
import {appsForOrganization} from '../public/control/registry.js';
import {server} from '../src/server.js';
const org = 'bb669217-41eb-4162-8040-a73f49a43570', id = '11111111-1111-4111-8111-111111111111';
const homeId = '22222222-1111-4111-8111-111111111111', awayId = '33333333-1111-4111-8111-111111111111';
const fixture = (patch = {}) => ({gameId: id, organizationId: org, startDate: '2026-10-01', startTime: '19:00', status: 'FINISHED',
  HomeTeam: {teamId: homeId, name: 'Domácí', foreignId: 'HOTOVĚ'}, AwayTeam: {teamId: awayId, name: 'Hosté', foreignId: 'FAKTURY'},
  referee: 'Jan; Petr; Jan', timekeeper: [{firstName: 'Anna', lastName: 'Malá', email: 'PRIVATE'}], Venue: {name: 'ICERINK'},
  Phase: {Group: {Season: {Competition: {competitionId: 'league', name: 'Liga'}}}}, paymentHost: 'NOT PAID', paymentGuest: 'PAID', ...patch});
const env = {HMS_API_TOKEN: 'api-secret', HMS_PHM_OPERATIONS_SECRET: 'viewer-secret'};
const query = {org: 'phm', from: '2026-10-01', to: '2026-10-31'};
const response = () => ({headers: {}, setHeader(key, value) {this.headers[key] = value;}, status(code) {this.code = code; return this;}, json(body) {this.body = body; return this;}});
test('periods validate calendar dates and inclusive equal-length comparisons', () => {
  assert.deepEqual(periods('2026-10-01', '2026-10-31'), {previous: {from: '2026-08-31', to: '2026-09-30'}, selected: {from: '2026-10-01', to: '2026-10-31'}, next: {from: '2026-11-01', to: '2026-12-01'}});
  assert.doesNotThrow(() => periods('2024-02-29', '2024-02-29'));
  for (const dates of [['2026-02-30', '2026-03-01'], ['2026-10-31', '2026-10-01'], ['2026-01-01', '2026-12-31']]) assert.throws(() => periods(...dates));
});
test('officials split multi-value fields and strip private person properties', () => {
  assert.deepEqual(people(['Jan; Petr', 'Jan', {firstName: 'Anna', lastName: 'Malá', email: 'PRIVATE'}]), ['Jan', 'Petr', 'Anna Malá']);
  assert.equal(people(undefined), null); assert.deepEqual(people(null), []);
  assert.doesNotMatch(JSON.stringify(normalizeGame(fixture())), /PRIVATE|foreignId|organizationId/);
});
test('billing is a team flag recognizing HOTOVE/CASH and FAKTURY without substring matches or guesses', () => {
  for (const value of ['CASH', 'HOTOVĚ', 'hotove', 'PHM; HOTOVĚ']) assert.equal(teamCash({foreignId: value}), true);
  assert.equal(teamCash({externalId: 'FAKTURY'}), false);
  assert.equal(teamCash({foreingId: 'FAKTURA'}), false);
  for (const value of ['CASHLESS', '', 'normal external ID']) assert.equal(teamCash({foreignId: value}), null);
  assert.equal(teamCash({}), null);
});
test('each game side has its own payment and never inherits the other side or a game-wide PAID', () => {
  const game = normalizeGame(fixture()); assert.equal(game.home.paid, false); assert.equal(game.away.paid, true);
  assert.equal(sidePaid({paymentGuest: 'PAID', paid: true}, 'home'), null);
  assert.equal(sidePaid({paymentHost: 'NOT_PAID'}, 'home'), false);
  assert.equal(sidePaid({paymentHost: 'OTHER'}, 'home'), null);
  assert.equal(sidePaid({homePayment: true}, 'home', {paidValue: true}), true);
});
test('CASH unpaid warning names the actual team and opponent with Venue', () => {
  const rows = paymentIssues(normalizeGame(fixture()), '2026-10-26');
  assert.equal(rows.length, 1); assert.equal(rows[0].team, 'Domácí'); assert.equal(rows[0].opponent, 'Hosté'); assert.equal(rows[0].side, 'home'); assert.equal(rows[0].venue, 'ICERINK'); assert.equal(rows[0].confirmedUnpaid, true);
});
test('away CASH debt is found independently when the home side is paid', () => {
  const game = normalizeGame(fixture({paymentHost: 'PAID', paymentGuest: 'NOT PAID', AwayTeam: {...fixture().AwayTeam, foreignId: 'HOTOVĚ'}}));
  const rows = paymentIssues(game, '2026-10-26'); assert.equal(rows.length, 1); assert.equal(rows[0].team, 'Hosté'); assert.equal(rows[0].side, 'away');
});
test('both unpaid CASH teams produce two team rows, invoice teams produce none', () => {
  const both = normalizeGame(fixture({paymentGuest: 'NOT PAID', AwayTeam: {...fixture().AwayTeam, foreignId: 'HOTOVĚ'}}));
  assert.equal(paymentIssues(both, '2026-10-26').length, 2);
  const invoice = normalizeGame(fixture({HomeTeam: {...fixture().HomeTeam, foreignId: 'FAKTURY'}})); assert.equal(paymentIssues(invoice, '2026-10-26').length, 0);
});
test('today, future and cancelled games never generate payment arrears', () => {
  const game = normalizeGame(fixture());
  for (const today of ['2026-09-01', '2026-10-01']) assert.deepEqual(paymentIssues(game, today), []);
  assert.deepEqual(paymentIssues({...game, status: 'CANCELLED'}, '2026-10-26'), []);
});
test('source missing payment is separate from a confirmed NOT PAID', () => {
  const game = normalizeGame(fixture({paymentHost: undefined}));
  assert.equal(paymentIssues(game, '2026-10-26')[0].confirmedUnpaid, false);
  assert.ok(warnings(game, '2026-10-26').includes('payment_unknown'));
  assert.ok(!warnings(game, '2026-10-26').includes('cash'));
});
test('missing staff, absent source data and future vacant ice stay distinct', () => {
  const game = normalizeGame(fixture({referee: null, timekeeper: undefined, AwayTeam: null}));
  assert.deepEqual(warnings(game, '2026-10-01'), ['staff_unknown', 'referee', 'ice']);
  assert.ok(warnings(game, '2026-10-02').includes('past_teams'));
  assert.ok(!warnings(game, '2026-10-02').includes('ice'));
});
test('attendance aggregates people/roles/competitions and chart ranks descending with colored-segment counts', () => {
  const games = [normalizeGame(fixture()), normalizeGame(fixture({gameId: 'prev', startDate: '2026-09-02'})), normalizeGame(fixture({gameId: 'next', startDate: '2026-11-02'})), normalizeGame(fixture({gameId: 'cancel', status: 'CANCELLED'}))];
  const model = aggregate(games, query, {today: '2026-10-26'});
  assert.equal(model.staff.find(person => person.name === 'Jan').selected, 1);
  assert.equal(model.staff.find(person => person.name === 'Jan').previous, 1);
  assert.equal(model.staff.find(person => person.name === 'Jan').next, 1);
  const chart = staffRanking([{name: 'Jan', competition: 'A', role: 'Rozhodčí', selected: 2}, {name: 'Jan', competition: 'B', role: 'Rozhodčí', selected: 3}, {name: 'Anna', competition: 'A', role: 'Časoměřič', selected: 7}]);
  assert.deepEqual(chart.map(person => [person.name, person.total]), [['Anna', 7], ['Jan', 5]]);
  assert.deepEqual(chart[1].competitions, {A: 2, B: 3}); assert.equal(staffRanking(model.staff, 'selected', 'Časoměřič').length, 1);
});
test('invoice filter retains only invoice team rows rather than both opponents or CASH counts', () => {
  const games = [normalizeGame(fixture())];
  const invoice = aggregate(games, query, {payment: 'invoice', today: '2026-10-26'});
  assert.equal(invoice.teams.length, 1); assert.equal(invoice.teams[0].team, 'Hosté'); assert.equal(invoice.teams[0].payment, 'FAKTURY'); assert.equal(invoice.teams[0].games, 1); assert.equal(invoice.cashIssues.length, 0);
  assert.equal(Object.hasOwn(invoice.teams[0], 'finished'), false);
  const cash = aggregate(games, query, {payment: 'cash', today: '2026-10-26'}); assert.equal(cash.teams[0].team, 'Domácí'); assert.equal(cash.cashIssues.length, 1);
});
test('CSV preserves Czech and neutralizes quoted and whitespace-prefixed spreadsheet formulas', () => {
  const result = csv([{name: '=HYPERLINK("x")', note: 'Čas; led'}, {name: '  =1+1'}], [['name', 'Jméno'], ['note', 'Poznámka']]);
  assert.match(result, /^\ufeff/); assert.ok(result.includes('"\'=HYPERLINK(""x"")"')); assert.ok(result.includes('"\'  =1+1"')); assert.ok(result.includes('"Čas; led"'));
});
test('protected endpoint denies access before reading and has no webhook fallback or cross-org access', async () => {
  let reads = 0; const handler = createOperationsHandler({env, read: async () => {reads++; return {org: 'PHM'};}});
  for (const headers of [{}, {authorization: 'Bearer wrong'}, {'x-hms-webhook-secret': 'viewer-secret'}]) {
    const res = response(); await handler({method: 'GET', headers, query}, res); assert.equal(res.code, 401); assert.equal(res.headers['cache-control'], 'private, no-store');
  }
  assert.equal(reads, 0); const allowed = response(); await handler({method: 'GET', headers: {authorization: 'Bearer viewer-secret'}, query}, allowed); assert.equal(allowed.code, 200);
  const other = response(); await handler({method: 'GET', headers: {authorization: 'Bearer viewer-secret'}, query: {...query, org: 'euchl'}}, other); assert.equal(other.code, 503);
  const access = response(); await handler({method: 'GET', headers: {}, query: {org: 'phm', action: 'access'}}, access); assert.doesNotMatch(JSON.stringify(access.body), /viewer-secret|api-secret|bb669/);
  const noFallback = response(); await createOperationsHandler({env: {HMS_WEBHOOK_SECRET: 'hook'}})({method: 'GET', headers: {authorization: 'Bearer hook'}, query}, noFallback); assert.equal(noFallback.code, 503);
});
test('live page binds organization/token/range, sanitizes source and confirms the final page', async () => {
  const result = await readOperations(query, {env, fetchGames: async (params, options) => {
    assert.equal(options.config.token, 'api-secret'); assert.equal(params.from, '2026-08-31'); assert.equal(params.to, '2026-12-01'); assert.equal(params.limit, OPERATIONS_PAGE_SIZE); return [fixture()];
  }});
  assert.equal(result.complete, true); assert.equal(result.hasMore, false); assert.equal(result.org, 'PHM'); assert.equal(result.games.length, 1); assert.doesNotMatch(JSON.stringify(result), /api-secret|PRIVATE/);
});
test('full pages remain incomplete and supply a monotonically advancing cursor', async () => {
  const result = await readOperations(query, {env, fetchGames: async () => Array.from({length: OPERATIONS_PAGE_SIZE}, (_, index) => fixture({gameId: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`}))});
  assert.equal(result.complete, false); assert.equal(result.hasMore, true); assert.equal(result.nextOffset, OPERATIONS_PAGE_SIZE);
});
test('foreign, duplicate, out-of-range and invalid source data abort the entire page', async () => {
  for (const rows of [[fixture({organizationId: 'other'})], [fixture({startDate: '2027-01-01'})], [fixture({gameId: 'bad'})], [fixture(), fixture()]]) await assert.rejects(readOperations(query, {env, fetchGames: async () => rows}));
  for (const offset of [-1, 1, 4000, 'bad', ['20']]) await assert.rejects(readOperations({...query, offset}, {env, fetchGames: async () => []}));
});
test('thin authenticated records hydrate exact matching details and sporting metadata', async () => {
  const thin = fixture({HomeTeam: undefined, AwayTeam: undefined, homeTeamId: homeId, awayTeamId: awayId, Venue: undefined, Phase: undefined, referee: undefined, timekeeper: undefined});
  const metadata = {...fixture(), organizationId: undefined, gameId: undefined};
  const result = await readOperations(query, {env, fetchGames: async () => [thin], fetchDetail: async () => thin, fetchMetadata: async () => metadata});
  assert.equal(result.games[0].home.name, 'Domácí'); assert.equal(result.games[0].venue, 'ICERINK'); assert.deepEqual(result.games[0].referees, ['Jan', 'Petr']);
});
test('foreign detail fails closed and mismatched public metadata cannot supply team/venue labels', async () => {
  await assert.rejects(readOperations(query, {env, fetchGames: async () => [fixture({Venue: undefined})], fetchDetail: async () => fixture({organizationId: 'other'})}));
  const game = fixture({Venue: undefined}); const wrong = fixture({HomeTeam: {teamId: 'other'}, Venue: {name: 'Wrong'}});
  assert.equal(enrichOperationsGame(game, wrong).Venue, undefined);
});
test('Operations remains organization-scoped Beta in the central map', () => {
  for (const code of ['phm', 'euchl']) { const app = appsForOrganization(code).find(app => app.id === 'operations'); assert.equal(app.status, 'partial'); assert.equal(app.links.open, '/operations?org=' + code); }
  assert.deepEqual(appsForOrganization('yhg').find(app => app.id === 'operations').links, {});
});
test('public shell, shared real HMS logo and demo serve while live API stays protected', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/operations?org=phm', '/operations/model.js', '/operations/demo.js', '/hms-logo.png', '/hms-brand.js']) assert.equal((await fetch(base + path)).status, 200);
    const shell = await (await fetch(base + '/operations')).text(); assert.match(shell, /id="brand"/); assert.match(shell, /id="payment"/);
    assert.ok([401, 503].includes((await fetch(base + '/api/operations?org=phm')).status));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
