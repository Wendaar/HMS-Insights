import test from 'node:test';
import assert from 'node:assert/strict';
import { applySpecialTeams } from '../src/domain/special-teams.js';
import { goalDetails, publicGoalDetails, SHOT_ZONES, NET_ZONES } from '../src/domain/goal-details.js';
import { enrichEventGroups } from '../src/hms/public-event-metadata.js';
import { fetchFinishedGameResponses, fetchPublicGameMetadata } from '../src/hms/client.js';
import { filterReportEvents, goalZoneCounts, situationCounts } from '../public/game-report-data.js';
import { analyzeHmsResponses } from '../src/app/analyze.js';
import { rowsFor } from '../src/infrastructure/analysis-rows.js';
import { buildGameSummary } from '../src/domain/game-summary.js';
import { renderGameReport } from '../src/web/game-report.js';
import { gameEvents, lineup } from '../src/fixtures/zbraslav-kosti.js';

const penalty = (time, team = 'home', extra = {}) => ({ id: `p${time}`, type: 'penalty', teamId: team, clockSeconds: time, penaltyMinutes: 2, penaltyDetails: { type: { name: 'Menší trest' } }, ...extra });
const goal = (time, team = 'away', extra = {}) => ({ id: `g${time}`, type: 'goal', teamId: team, clockSeconds: time, details: {}, ...extra });
const classify = (events, options = {}) => { applySpecialTeams(events, { consistent: true, ordered: true, penaltiesAvailable: true, homeId: 'home', awayId: 'away', ...options }); return events.filter((event) => event.type === 'goal').map((event) => event.situation); };

test('a PP goal ends the minor penalty; a subsequent goal defaults to 5 on 5', () => {
  assert.deepEqual(classify([penalty(60), goal(90), goal(100)]).map((s) => s.code), ['PP', 'EV']);
});
test('a short-handed goal does not end the penalty; exact expiration does', () => {
  assert.deepEqual(classify([penalty(60), goal(90, 'home'), goal(100)]).map((s) => s.code), ['SH', 'PP']);
  assert.equal(classify([penalty(60), goal(180)])[0].code, 'EV');
});
test('coincidental penalties and same-second uncertainty never imply PP', () => {
  assert.equal(classify([penalty(60), penalty(60, 'away'), goal(90)])[0].code, 'EV');
  assert.ok(classify([penalty(60), goal(90), penalty(90, 'away'), goal(100)]).every((s) => s.code === 'UNKNOWN'));
});
test('queued and major penalties, clock resets and incomplete snapshots disable estimation', () => {
  for (const events of [
    [penalty(60, 'home', { penaltyDetails: { type: { name: 'Major' } } }), goal(90)],
    [penalty(60, 'home', { penaltyMinutes: 4 }), goal(90)],
    [penalty(60), penalty(80), goal(90)],
    [penalty(60), goal(20)],
    [penalty(60, 'home', { clockSeconds: null }), goal(90)],
  ]) assert.ok(classify(events).every((s) => s.code === 'UNKNOWN'));
  assert.equal(classify([penalty(60), goal(90)], { consistent: false })[0].code, 'UNKNOWN');
  assert.equal(classify([penalty(60), goal(90)], { penaltiesAvailable: false })[0].code, 'UNKNOWN');
});
test('short untyped penalties support an explicitly disclosed duration assumption', () => {
  const [s] = classify([penalty(60, 'home', { penaltyDetails: null }), goal(90)]);
  assert.equal(s.code, 'PP'); assert.equal(s.source, 'penalty-model'); assert.equal(s.basis, 'duration-assumption');
  assert.equal(classify([penalty(60), goal(90)])[0].basis, 'minor-penalty');
});
test('recorded HMS strength wins and penalty shots are not classified from penalties', () => {
  const marked = goal(90, 'away', { details: { goalType: { name: 'Even strength' } } });
  assert.deepEqual(classify([penalty(60), marked, goal(100)]).map((s) => [s.code, s.source]), [['EV', 'hms'], ['UNKNOWN', 'unknown']]);
  assert.equal(classify([penalty(60), goal(90, 'away', { details: { goalSubtype: { name: 'Penalty shot' } } })])[0].code, 'UNKNOWN');
  assert.equal(classify([goal(60, 'home', { details: { goalType: { name: 'Power play 5 on 4' } } })], { consistent: false })[0].source, 'hms');
});
test('zone names resolve to categories; bare IDs and unrecognized names remain unknown', () => {
  const details = publicGoalDetails(goalDetails({ ListEventLocation: { name: 'Between the circles', private: 'hidden' }, ListGoalLocation: { name: 'Five hole' }, ListShotType: { name: 'Forehand', private: 'hidden' } }));
  assert.equal(details.shotZone.code, 'between-circles'); assert.equal(details.netZone.code, 'five-hole');
  assert.doesNotMatch(JSON.stringify(details), /hidden|private/);
  assert.equal(publicGoalDetails(goalDetails({ listEventLocationId: 'abc' })).shotZone.code, null);
  assert.equal(publicGoalDetails(goalDetails({ ListGoalLocation: { name: 'new region' } })).netZone.code, null);
  assert.equal(SHOT_ZONES.length, 15); assert.equal(NET_ZONES.length, 9);
});
function enrichmentInput() {
  const event = { gameTime: '1:20', period: 1, scoredByTeamId: 'home' };
  return { groups: { goals: { events: [event] }, penalties: { events: [] }, saves: { events: [] } },
    metadata: { HomeTeamGoals: 1, AwayTeamGoals: 0, GameEvents: [{ ...event, entity: 'GameEventGoal', ListEventLocation: { name: 'Left circle', email: 'private' }, email: 'private' }] }, detail: { HomeTeamGoals: 1, AwayTeamGoals: 0 } };
}
test('optional public enrichment only copies allowlisted labels from unique matching events', () => {
  const { groups, metadata, detail } = enrichmentInput(); enrichEventGroups(groups, metadata, detail);
  assert.equal(groups.goals.events[0].ListEventLocation.name, 'Left circle');
  assert.doesNotMatch(JSON.stringify(groups), /private|email/);
  for (const kind of ['duplicate-public', 'duplicate-primary', 'score', 'clock', 'conflicting-id']) {
    const input = enrichmentInput();
    if (kind === 'duplicate-public') input.metadata.GameEvents.push(input.metadata.GameEvents[0]);
    if (kind === 'duplicate-primary') input.groups.goals.events.push(input.groups.goals.events[0]);
    if (kind === 'score') input.metadata.HomeTeamGoals = 2;
    if (kind === 'clock') input.groups.goals.events[0].gameTime = null;
    if (kind === 'conflicting-id') { input.groups.goals.events[0].listEventLocationId = 'a'; input.metadata.GameEvents[0].ListEventLocation.listEventLocationId = 'b'; }
    enrichEventGroups(input.groups, input.metadata, input.detail);
    assert.equal(input.groups.goals.events[0].ListEventLocation, undefined, kind);
  }
});
test('public metadata is optional and never receives the integration credential', async () => {
  const calls = [];
  const responses = await fetchFinishedGameResponses('id', { config: { token: 'private', baseUrl: 'https://example.test/api/v1' }, fetchImpl: async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (new URL(url).pathname === '/public/game') throw new Error('unavailable');
    return { ok: true, json: async () => ({ gameId: 'id' }) };
  } });
  assert.equal(responses.length, 4); assert.equal(responses[3], null);
  assert.equal(calls[3].url.origin, 'https://api.prod.hms.wootera.net');
  assert.equal(calls[3].init.headers.authorization, undefined);
  assert.ok(calls.slice(0, 3).every((call) => call.init.headers.authorization === 'Bearer private'));
  assert.equal(await fetchPublicGameMetadata('id', { fetchImpl: async () => ({ ok: false }) }), null);
});
test('enriched sporting details survive normalization, storage rows and the public summary with the team goal milestone', () => {
  const source = structuredClone(gameEvents);
  const first = source.GameEventGoals[0];
  const metadata = { HomeTeamGoals: 5, AwayTeamGoals: 10, GameEvents: [
    { ...first, entity: 'GameEventGoal', ListEventLocation: { name: 'Left circle' }, ListGoalLocation: { name: 'Top shelf' }, ListShotType: { name: 'Forehand' }, ListGoalType: { name: 'Even strength 5 on 5' }, privateContact: 'hidden' },
    ...source.GameEventPenalties.map((event) => ({ ...event, entity: 'GameEventPenalty', ListPenaltyType: { name: 'Menší trest' } })),
  ] };
  const analysis = analyzeHmsResponses(source, lineup, null, metadata);
  const rows = rowsFor(analysis);
  const summary = buildGameSummary({ game: rows.games[0], teams: rows.team_game_stats, players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy });
  const g = summary.timeline.events.find((event) => event.type === 'goal');
  assert.equal(g.details.shotZone.code, 'left-circle');
  assert.equal(g.details.netZone.code, 'top-shelf');
  assert.equal(g.details.shotType.name, 'Forehand');
  assert.equal(g.situation.source, 'hms');
  assert.equal(situationCounts(summary.timeline.events).estimated.PP, 3);
  assert.equal(summary.priklepy.length, 5);
  assert.ok(summary.priklepy.some((item) => item.type === 'TEAM_GOAL_MILESTONE'));
  assert.doesNotMatch(JSON.stringify(summary), /hidden|privateContact/);
});
test('team/period/type and unknown-zone filters preserve honest map coverage', () => {
  const events = [goal(1, 'home', { period: 1, details: { shotZone: { code: 'left-circle' } }, situation: { code: 'PP', source: 'hms' } }), goal(2, 'away'), { type: 'save', teamId: 'home' }, penalty(3)];
  assert.equal(filterReportEvents(events).length, 3);
  assert.equal(filterReportEvents(events, { type: 'save' }).length, 1);
  assert.equal(filterReportEvents(events, { team: 'HOME', period: 1, type: 'goal' }).length, 1);
  assert.equal(filterReportEvents(events, { zoneKind: 'shotZone', zoneCode: 'unknown' }).length, 1);
  assert.deepEqual(Object.values(goalZoneCounts(events, 'shotZone', SHOT_ZONES)).slice(0, 3), [2, 1, 1]);
  assert.equal(situationCounts(events).recorded.PP, 1); assert.equal(situationCounts(events).unknown, 1);
});
test('report renders a horizontal rail, maps, dialog and safe inert summary data', () => {
  const rows = rowsFor(analyzeHmsResponses(gameEvents, lineup));
  const summary = buildGameSummary({ game: rows.games[0], teams: rows.team_game_stats, players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy });
  summary.home.name = '</script><script>alert(1)</script>';
  const page = renderGameReport(summary);
  assert.match(page, /id="event-rail"/); assert.match(page, /<dialog id="event-dialog"/);
  assert.match(page, /data-map="shotZone"/); assert.match(page, /data-map="netZone"/);
  assert.match(page, /type="module" src="\/game-report.js"/);
  const data = page.match(/id="game-report-data">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(data, /<script/); assert.equal(JSON.parse(data).summary.home.name, summary.home.name);
  assert.equal(summary.priklepy.length, 5);
});
