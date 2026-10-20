import test from "node:test";
import assert from "node:assert/strict";
import { sampleAnalysis } from "../src/app/sample.js";
import { rowsFor } from "../src/infrastructure/analysis-rows.js";
import { buildGameSummary, isGameId } from "../src/domain/game-summary.js";
import { getGameSummary } from "../src/app/game-summary.js";
import { loadGameSnapshot, persistAnalysisPostgres, publicFeedItem } from "../src/infrastructure/postgres-repository.js";
import { createGameReportHandler } from "../src/web/game-report-handler.js";
import { renderGameReport } from "../src/web/game-report.js";
import { processFinishedGame } from "../src/app/process-finished-game.js";
import { gameEventsResponse, lineupResponse } from "../src/fixtures/real-game-sanitized.js";
import { neon, neonConfig } from "@neondatabase/serverless";

const rows = rowsFor(sampleAnalysis);
const snapshot = { game: rows.games[0], teams: rows.team_game_stats,
  players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy };
const id = snapshot.game.game_id;

test("GameSummary preserves 9:3, all ten Příklepy and ranked public stats", () => {
  const summary = buildGameSummary(snapshot);
  assert.equal(summary.schemaVersion, 1);
  assert.deepEqual([summary.home.score, summary.away.score], [9, 3]);
  assert.equal(summary.priklepy.length, 10);
  assert.deepEqual(summary.goalies.map((p) => p.saves), [34, 31]);
  assert.equal(summary.players[0].points, 4);
  assert.deepEqual([summary.home.lineupSize, summary.away.lineupSize], [11, 14]);
});

test("official result survives missing events and no achievements; never infer coverage", () => {
  const summary = buildGameSummary({ game: { ...snapshot.game, event_snapshot: null } });
  assert.equal(summary.home.score, 9);
  assert.deepEqual(summary.priklepy, []);
  assert.equal(summary.provenance.eventCoverage, "unknown");
  assert.equal(summary.provenance.timelineAvailable, false);
  assert.equal(summary.home.lineupSize, null);
  assert.match(renderGameReport(summary), /zatím nejsou žádné Příklepy/);
});

test("public contract drops arbitrary raw fields and facts at every level", () => {
  const privateFields = { HMS_API_TOKEN: "SECRET_SENTINEL", email: "PRIVATE_SENTINEL", raw: "PRIVATE_SENTINEL" };
  const enriched = Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key,
    Array.isArray(value) ? value.map((r) => ({ ...r, ...privateFields, facts: privateFields })) : { ...value, ...privateFields },
  ]));
  assert.doesNotMatch(JSON.stringify(buildGameSummary(enriched)), /SENTINEL|HMS_API_TOKEN|email|facts/);
});

test("service validates UUID structure before touching the database, accepts HMS v1 UUIDs", async () => {
  assert.equal(isGameId("F6321894-98CA-11F1-8BDF-EF2495D048F3"), true);
  for (const invalid of ["-".repeat(36), `${id}'`, [id], null]) {
    await assert.rejects(getGameSummary(invalid, { loadSnapshot: () => assert.fail("unexpected read") }), TypeError);
  }
  assert.equal(await getGameSummary(id, { loadSnapshot: async () => null }), null);
  assert.equal((await getGameSummary(id, { loadSnapshot: async () => snapshot })).gameId, id);
});

test("snapshot reader uses one parameterized statement without requiring a Příklep", async () => {
  let calls = 0;
  const result = await loadGameSnapshot(id, { sql: { query: async (text, values) => {
    calls++;
    assert.match(text, /from games g where g.game_id = \$1::uuid/);
    assert.match(text, /'\[\]'::jsonb/);
    assert.deepEqual(values, [id]);
    return [snapshot];
  } } });
  assert.equal(calls, 1);
  assert.equal(result, snapshot);
});

function response() {
  return { headers: {}, code: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

for (const json of [true, false]) {
  test(`public ${json ? "JSON" : "HTML"} handler: success, 400, 404, 405, 503 and safe errors`, async () => {
    for (const [method, gameId, load, expected] of [
      ["GET", id, async () => buildGameSummary(snapshot), 200],
      ["GET", "invalid", () => assert.fail("unexpected load"), 400],
      ["GET", id, async () => null, 404],
      ["POST", id, () => assert.fail("unexpected load"), 405],
      ["GET", id, async () => { throw new Error("postgres://SECRET_SENTINEL"); }, 503],
    ]) {
      const res = response();
      await createGameReportHandler({ json, loadSummary: load })({ method, query: { gameId } }, res);
      assert.equal(res.code, expected);
      assert.doesNotMatch(JSON.stringify(res.body), /SECRET_SENTINEL/);
      assert.equal(res.headers["cache-control"], expected === 200 ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store");
      if (expected === 405) assert.equal(res.headers.allow, "GET");
      if (expected === 200 && !json) assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    }
  });
}

test("HTML escapes HMS text in content and attributes", () => {
  const summary = buildGameSummary(snapshot);
  summary.home.name = '<script>alert("x")</script>';
  summary.priklepy[0].text = '<img src=x onerror="alert(1)">';
  const rendered = renderGameReport(summary);
  assert.doesNotMatch(rendered, /<script>|<img src=x/);
  assert.match(rendered, /&lt;script&gt;/);
  assert.match(rendered, /&lt;img/);
});

test("manual synchronization and corrected reimport need no webhook event type", async () => {
  let stored;
  const persist = async (analysis) => {
    const r = rowsFor(analysis);
    stored = { game: r.games[0], teams: r.team_game_stats, players: r.player_game_stats,
      goalies: r.goalie_game_stats, priklepy: r.detected_priklepy };
  };
  await processFinishedGame(id, { fetchResponses: async () => [gameEventsResponse, lineupResponse], persist });
  assert.equal(buildGameSummary(stored).priklepy.length, 10);
  const corrected = { ...gameEventsResponse, HomeTeamGoals: 2, AwayTeamGoals: 3 };
  await processFinishedGame(id, { fetchResponses: async () => [corrected, lineupResponse], persist });
  assert.equal(buildGameSummary(stored).home.score, 2);
  assert.equal(buildGameSummary(stored).priklepy.some((p) => p.type === "BIG_WIN"), false);
});

test("failed transaction propagates and all replacement statements stay in one batch", async () => {
  let batch;
  await assert.rejects(persistAnalysisPostgres(sampleAnalysis, { sql: {
    query: (text, values) => ({ text, values }),
    transaction: async (queries) => { batch = queries; throw new Error("rollback"); },
  } }), /rollback/);
  assert.match(batch[0].text, /pg_advisory_xact_lock/);
  assert.equal(batch[1].text, "delete from games where game_id = $1");
  assert.match(batch.at(-1).text, /^insert into detected_priklepy/);
});

test("Příklepy keep their HMS link and add a local report link", () => {
  const item = publicFeedItem({ game_id: id });
  assert.equal(item.gameReportUrl, `/game-center/${id}`);
  assert.match(item.gameDetailUrl, /prod.hms.wootera.net\/embed\/game/);
});

test("real Neon driver sends replacement as one transaction request", async () => {
  const originalFetch = neonConfig.fetchFunction;
  const requests = [];
  try {
    neonConfig.fetchFunction = async (_url, init) => {
      const body = JSON.parse(init.body);
      if (!body.queries) return { ok: true, json: async () => ({ fields: [{ name: "data_type", dataTypeID: 25 }], rows: [["jsonb"]] }) };
      requests.push(body);
      return { ok: true, json: async () => ({ results: body.queries.map(() => ({ fields: [], rows: [] })) }) };
    };
    await persistAnalysisPostgres(sampleAnalysis, { sql: neon("postgresql://test:test@db.example.test/test") });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].queries.length, 7);
    assert.match(requests[0].queries[0].query, /pg_advisory_xact_lock/);
    assert.deepEqual(requests[0].queries[1].params, [id]);
  } finally {
    neonConfig.fetchFunction = originalFetch;
  }
});
