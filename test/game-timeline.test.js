import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHmsResponses } from "../src/app/analyze.js";
import { rowsFor } from "../src/infrastructure/analysis-rows.js";
import { buildGameSummary } from "../src/domain/game-summary.js";
import { renderGameReport } from "../src/web/game-report.js";
import { gameId, gameEvents, lineup } from "../src/fixtures/zbraslav-kosti.js";
import { ensureEventSnapshotSchema, persistAnalysisPostgres } from "../src/infrastructure/postgres-repository.js";
import { processFinishedGame } from "../src/app/process-finished-game.js";

const analyze = (events = gameEvents, detail = null) => analyzeHmsResponses(events, lineup, detail);
test('a penalty without a recorded duration remains null rather than displaying a zero-minute penalty',()=>{
  const source=structuredClone(gameEvents);source.GameEventPenalties[0].duration=null;
  const penalty=summarize(analyze(source)).timeline.events.find(e=>e.type==='penalty');
  assert.equal(penalty.penaltyMinutes,null);
});
function summarize(analysis) {
  const r = rowsFor(analysis);
  return buildGameSummary({ game: r.games[0], teams: r.team_game_stats,
    players: r.player_game_stats, goalies: r.goalie_game_stats, priklepy: r.detected_priklepy });
}

test("Zbraslav–Kosti: public-log reconstruction preserves 5:10, 15 goals, 4 penalties and the 10th-goal milestone", () => {
  const summary = summarize(analyze());
  assert.equal(summary.gameId, gameId);
  assert.deepEqual([summary.home.score, summary.away.score], [5, 10]);
  assert.equal(summary.timeline.events.filter((event) => event.type === "goal").length, 15);
  assert.equal(summary.timeline.events.filter((event) => event.type === "penalty").length, 4);
  assert.equal(summary.timeline.events.filter((event) => event.type === "save").length, 46);
  assert.equal(summary.priklepy.length, 5);
  assert.ok(summary.priklepy.some((item) => item.type === "TEAM_GOAL_MILESTONE"));
  assert.deepEqual(summary.players.slice(0, 2).map((p) => [p.name, p.goals, p.assists, p.points]), [
    ["Mansur Ischoev", 3, 5, 8], ["Adam Patočka", 4, 3, 7],
  ]);
  assert.deepEqual(summary.goalies.map((g) => g.saves), [27, 19]);
  assert.equal(summary.provenance.eventCoverage, "matches-result");
  assert.deepEqual(summary.timeline.periodScores, []); // No guessed 15-minute periods.
});

test("all fifteen running scores match the public HMS event log", () => {
  const timeline = summarize(analyze()).timeline;
  assert.equal(timeline.ordered, true);
  assert.deepEqual(timeline.events.filter((e) => e.type === "goal").map((e) => `${e.scoreAfter.home}:${e.scoreAfter.away}`), [
    "1:0", "1:1", "2:1", "2:2", "2:3", "2:4", "2:5", "3:5", "3:6", "3:7", "4:7", "4:8", "5:8", "5:9", "5:10",
  ]);
  const last = timeline.events.filter((e) => e.type === "goal").at(-1);
  assert.equal(last.clock, "42:17");
  assert.deepEqual(last.assists.map((p) => p.name), ["Adam Patočka", "Mansur Ischoev"]);
  const firstPenalty = timeline.events.find((e) => e.type === "penalty");
  assert.equal(firstPenalty.clock, "24:14");
  assert.equal(firstPenalty.penaltyMinutes, 1.75);
});

test("per-period scores use source period labels and handle clocks resetting", () => {
  const input = structuredClone(gameEvents);
  input.GameEventGoals.forEach((e, i) => { e.period = i < 5 ? "1. Třetina" : "2. Třetina"; e.gameTime = `${i < 5 ? i : i - 5}:10`; });
  const summary = summarize(analyze(input));
  assert.deepEqual(summary.timeline.periodScores, [{ period: 1, home: 2, away: 3 }, { period: 2, home: 3, away: 7 }]);
  const goals = summary.timeline.events.filter((e) => e.type === "goal");
  assert.deepEqual(goals.at(-1).scoreAfter, { home: 5, away: 10 });
});

test("official-score mismatch preserves events and final result but hides derived running/period scores", () => {
  const input = { ...gameEvents, AwayTeamGoals: 11 };
  const summary = summarize(analyze(input));
  assert.equal(summary.away.score, 11);
  assert.equal(summary.timeline.coverage, "score-mismatch");
  assert.equal(summary.provenance.scoreWasOverridden, true);
  assert.equal(summary.timeline.events.filter((e) => e.type === "goal").length, 15);
  assert.ok(summary.timeline.events.filter((e) => e.type === "goal").every((e) => e.scoreAfter === null));
  assert.deepEqual(summary.timeline.periodScores, []);
  assert.equal(summary.priklepy.some((p) => p.type === "HATTRICK"), false);
});

test("unpositioned penalties are disclosed separately from known goal order", () => {
  const input = structuredClone(gameEvents);
  input.GameEventPenalties[0].gameTime = null;
  const summary = summarize(analyze(input));
  assert.equal(summary.timeline.ordered, true);
  assert.equal(summary.timeline.unplacedEvents, 1);
  assert.deepEqual(summary.timeline.collections, { goals: true, penalties: true, saves: true });
  assert.match(renderGameReport(summary), /Další události bez úplného času/);
});

test("missing or tied goal clocks never manufacture a score order", () => {
  for (const missing of [true, false]) {
    const input = structuredClone(gameEvents);
    input.GameEventGoals[0].gameTime = missing ? null : input.GameEventGoals[1].gameTime;
    const summary = summarize(analyze(input));
    assert.equal(summary.timeline.ordered, false);
    assert.ok(summary.timeline.events.filter((e) => e.type === "goal").every((e) => e.scoreAfter === null));
    assert.match(renderGameReport(summary), /nelze určit přesné pořadí/);
  }
});

test("explicit empty events override stale embedded detail; cross-game detail rejected", () => {
  const summary = summarize(analyze({ gameId, events: [] }, gameEvents));
  assert.deepEqual(summary.timeline.events, []);
  assert.equal(summary.timeline.coverage, "score-mismatch");
  assert.equal(summary.home.score, 5);
  assert.throws(() => analyze(gameEvents, { ...gameEvents, gameId: "00000000-0000-0000-0000-000000000000" }), /různým zápasům/);
});

test("duplicate source IDs count once; contradictory copies abort before persistence", async () => {
  const duplicate = { ...gameEvents, GameEventGoals: [...gameEvents.GameEventGoals, gameEvents.GameEventGoals[0]] };
  assert.equal(analyze(duplicate).game.goals.length, 15);
  assert.equal(summarize(analyze(duplicate)).timeline.coverage, "matches-result");
  const conflicting = structuredClone(duplicate);
  conflicting.GameEventGoals[conflicting.GameEventGoals.length - 1] = { ...conflicting.GameEventGoals.at(-1), gameTime: "44:00" };
  await assert.rejects(processFinishedGame(gameId, {
    fetchResponses: async () => [conflicting, lineup], persist: () => assert.fail("must not write ambiguous events"),
  }), /konfliktní/);
});

test("unified HMS events format shares the same snapshot and official detail takes precedence", () => {
  const events = { gameId, HomeTeamGoals: 0, events: [
    ...gameEvents.GameEventGoals.map((event) => ({ ...event, type: "goal" })),
    ...gameEvents.GameEventPenalties.map((event) => ({ ...event, type: "penalty" })),
    ...gameEvents.GameEventSaves.map((event) => ({ ...event, type: "save" })),
  ] };
  const summary = summarize(analyze(events, gameEvents));
  assert.equal(summary.home.score, 5);
  assert.equal(summary.timeline.coverage, "matches-result");
  assert.equal(summary.timeline.events.length, 65);
});

test("reimport replaces rather than appends events; deletion and assistance corrections propagate", async () => {
  const replacements = [];
  const sql = {
    query: (text, values) => text.startsWith("select data_type") ? [{ data_type: "jsonb" }] : { text, values },
    transaction: async (queries) => {
      assert.equal(queries[1].text, "delete from games where game_id = $1");
      const insert = queries.find((q) => q.text.startsWith("insert into games"));
      const columns = insert.text.match(/insert into games \((.*?)\)/)[1].split(", ");
      replacements.push(JSON.parse(insert.values[columns.indexOf("event_snapshot")]));
    },
  };
  for (let i = 0; i < 2; i++) await processFinishedGame(gameId, {
    fetchResponses: async () => [gameEvents, lineup], persist: (a) => persistAnalysisPostgres(a, { sql, ensureSchema: false, refreshSeasonInsights: false }),
  });
  assert.deepEqual(replacements[0], replacements[1]);
  const corrected = structuredClone(gameEvents);
  corrected.GameEventGoals.at(-1).isDeleted = true;
  corrected.GameEventPenalties[0].isDeleted = true;
  corrected.GameEventGoals[0].assistedBy1PlayerId = null;
  corrected.AwayTeamGoals = 9;
  await processFinishedGame(gameId, {
    fetchResponses: async () => [corrected, lineup], persist: (a) => persistAnalysisPostgres(a, { sql, ensureSchema: false, refreshSeasonInsights: false }),
  });
  assert.equal(replacements.at(-1).events.filter((e) => e.type === "goal").length, 14);
  assert.equal(replacements.at(-1).events.filter((e) => e.type === "penalty").length, 3);
  const summary = summarize(analyze(corrected));
  assert.deepEqual(summary.timeline.events.filter((e) => e.type === "goal").at(-1).scoreAfter, { home: 5, away: 9 });
  assert.equal(summary.players.find((p) => p.name === "Jakub Chmel").assists, 0);
  assert.equal(summary.players.find((p) => p.name === "Mansur Ischoev").penaltyMinutes, 0);
});

test("event storage and public mapping omit raw/contact fields; event text remains escaped", () => {
  const input = structuredClone(gameEvents);
  input.GameEventGoals[0].secret = "SECRET_SENTINEL";
  input.GameEventGoals[0].ScoredByPlayer = { email: "PRIVATE_SENTINEL" };
  const analysis = analyze(input);
  assert.doesNotMatch(JSON.stringify(analysis.game.eventSnapshot), /SENTINEL|email|secret/);
  const r = rowsFor(analysis);
  r.games[0].event_snapshot.events[0].facts = { secret: "PRIVATE_SENTINEL" };
  r.games[0].event_snapshot.events[0].player.name = '<script>alert("x")</script>';
  const summary = buildGameSummary({ game: r.games[0] });
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_SENTINEL|facts/);
  assert.doesNotMatch(renderGameReport(summary), /<script>/);
  assert.match(renderGameReport(summary), /&lt;script&gt;/);
});

test("legacy/unknown event snapshots stay readable; empty 0:0 is distinct from missing events", () => {
  const legacy = rowsFor(analyze()).games[0];
  delete legacy.event_snapshot;
  assert.equal(buildGameSummary({ game: legacy }).timeline.available, false);
  legacy.event_snapshot = { version: 99, events: [] };
  assert.equal(buildGameSummary({ game: legacy }).timeline.available, false);
  const zero = summarize(analyze({ ...gameEvents, HomeTeamGoals: 0, AwayTeamGoals: 0,
    GameEventGoals: [], GameEventSaves: [], GameEventPenalties: [] }));
  assert.equal(zero.timeline.available, true);
  assert.equal(zero.timeline.coverage, "matches-result");
  assert.match(renderGameReport(zero), /nejsou góly ani tresty/);
});

test("nullable event schema upgrade runs only if absent and failures leave data writes unstarted", async () => {
  const calls = [];
  assert.equal(await ensureEventSnapshotSchema({ sql: { query: async (text) => { calls.push(text); return []; } } }), true);
  assert.match(calls[1], /add column if not exists event_snapshot jsonb/);
  assert.equal(await ensureEventSnapshotSchema({ sql: { query: async () => [{ data_type: "jsonb" }] } }), false);
  await assert.rejects(persistAnalysisPostgres(analyze(), { sql: {
    query: async () => { throw new Error("schema unavailable"); },
    transaction: () => assert.fail("must not delete stored game"),
  } }), /schema unavailable/);
});
