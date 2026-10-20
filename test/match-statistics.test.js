import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFaceoffs, goalieStatistics } from '../src/domain/recorded-statistics.js';
import { faceoffSnapshot } from '../src/hms/faceoffs.js';
import { analyzeHmsResponses } from '../src/app/analyze.js';
import { rowsFor } from '../src/infrastructure/analysis-rows.js';
import { buildGameSummary } from '../src/domain/game-summary.js';
import { renderGameReport } from '../src/web/game-report.js';
import { gameEvents, lineup } from '../src/fixtures/zbraslav-kosti.js';

const summarize = (analysis) => {
  const rows = rowsFor(analysis);
  return buildGameSummary({ game: rows.games[0], teams: rows.team_game_stats, players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy });
};
test('save percentage uses saves plus attributed goals and never divides by zero', () => {
  assert.deepEqual(goalieStatistics({ saves: 27, goals_against: 10 }), { saves: 27, goalsAgainst: 10, shotsAgainst: 37, savePercentage: 72.97, statisticsBasis: 'recorded-events' });
  assert.equal(goalieStatistics({ saves: 19, goals_against: 5 }).savePercentage, 79.17);
  assert.equal(goalieStatistics({ saves: 0, goals_against: 2 }).savePercentage, 0);
  assert.equal(goalieStatistics({ saves: 2, goals_against: 0 }).savePercentage, 100);
  for (const row of [{ saves: 0, goals_against: 0 }, { saves: null, goals_against: 1 }, { saves: 1, goals_against: null }, { saves: -1, goals_against: 2 }]) assert.equal(goalieStatistics(row).savePercentage, null);
});
test('a goalie with goals against but zero saves is retained by normalization', () => {
  const source = structuredClone(gameEvents); source.GameEventSaves = [];
  const result = summarize(analyzeHmsResponses(source, lineup));
  assert.equal(result.goalies.length, 2);
  assert.ok(result.goalies.every((keeper) => keeper.savePercentage === 0));
  assert.equal(result.goalies.reduce((total, keeper) => total + keeper.goalsAgainst, 0), 15);
});
test('HMS faceoff totals survive storage rows and map to both teams', () => {
  const summary = summarize(analyzeHmsResponses(gameEvents, lineup));
  assert.equal(summary.faceoffs.homeWins, 25); assert.equal(summary.faceoffs.awayWins, 19);
  assert.equal(summary.faceoffs.total, 44);
  assert.equal(summary.faceoffs.homePercentage, 56.82); assert.equal(summary.faceoffs.awayPercentage, 43.18);
  assert.equal(summary.priklepy.length, 4);
  const page = renderGameReport(summary);
  assert.match(page, /56,8 %/); assert.match(page, /43,2 %/);
  assert.match(page, /73,0 %/); assert.match(page, /79,2 %/);
  const filter = page.match(/<select id="report-team">([\s\S]*?)<\/select>/)[1];
  assert.equal((filter.match(/<option /g) ?? []).length, 3);
  assert.match(filter, /Oba týmy<\/option><option value=/);
  assert.equal(summary.timeline.events.find((event) => event.clock === '26:16').situation.code, 'PP');
  assert.equal(summary.timeline.events.find((event) => event.clock === '33:09').situation.code, 'PP');
  assert.equal(summary.timeline.events.filter((event) => event.situation?.source === 'penalty-model' && event.situation.code === 'PP').length, 3);
});
const match = { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 0 };
test('faceoffs use official totals before events and matching public totals only as fallback', () => {
  const metadata = { HomeTeamGoals: 1, AwayTeamGoals: 0, HomeTeamFaceOffs: 25, AwayTeamFaceOffs: 19 };
  assert.equal(faceoffSnapshot({}, null, metadata, match, new Map()).source, 'hms-public-totals');
  assert.equal(faceoffSnapshot({ HomeTeamFaceOffs: 3, AwayTeamFaceOffs: 4 }, null, metadata, match, new Map()).homeWins, 3);
  assert.equal(faceoffSnapshot({}, { HomeTeamFaceOffs: 5, AwayTeamFaceOffs: 6 }, metadata, match, new Map()).homeWins, 5);
  assert.equal(faceoffSnapshot({}, null, { ...metadata, HomeTeamGoals: 2 }, match, new Map()), null);
  assert.equal(faceoffSnapshot({}, null, { ...metadata, homeTeamId: 'other' }, match, new Map()), null);
  assert.equal(faceoffSnapshot({ HomeTeamFaceOffs: null, AwayTeamFaceOffs: null }, null, null, match, new Map()), null);
});
test('faceoff events deduplicate, ignore deleted entries and preserve unknown winners', () => {
  const win = { gameEventFaceOffId: 'same', wonByTeamId: 'HOME' };
  const result = faceoffSnapshot({ GameEventFaceOffs: [win, win, { wonByTeamId: 'away' }, { wonByTeamId: 'away', isDeleted: true }, {}] }, null, null, match, new Map());
  assert.deepEqual(result, { homeWins: 1, awayWins: 1, unattributed: 1, source: 'recorded-events' });
  assert.equal(buildFaceoffs({ faceoffs: result }).homePercentage, null);
  assert.equal(buildFaceoffs({ faceoffs: { ...result, unattributed: 0 } }).homePercentage, 50);
});
test('missing faceoffs remain unavailable; explicit 0:0 has no percentage', () => {
  assert.equal(buildFaceoffs(null).available, false);
  const empty = faceoffSnapshot({ GameEventFaceOffs: [] }, null, null, match, new Map());
  assert.equal(buildFaceoffs({ faceoffs: empty }).total, 0);
  assert.equal(buildFaceoffs({ faceoffs: empty }).homePercentage, null);
});
