import test from "node:test";
import assert from "node:assert/strict";
import { capturePregameRankings } from "../src/app/pregame-rankings.js";
import { PHM_ORGANIZATION_ID } from "../src/app/organizations.js";
import { detectRankingUpset } from "../src/domain/ranking-rules.js";
import { publicPregameRanking } from "../src/domain/game-summary.js";
import { createPregameRankingsHandler } from "../src/web/pregame-rankings-handler.js";
import { savePregameRankings } from "../src/infrastructure/postgres-repository.js";

const id = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
const gameId = id("1"), secondGameId = id("2"), homeId = id("3"), awayId = id("4");
const competitionId = id("5"), seasonId = id("6"), groupId = id("7"), phaseId = id("8");

const game = {
  gameId, organizationId: PHM_ORGANIZATION_ID, competitionId, seasonId, groupId,
  teamStats: [
    { side: "HOME", teamId: homeId, teamName: "LEV", goals: 5 },
    { side: "AWAY", teamId: awayId, teamName: "VOHOLTO", goals: 3 },
  ],
};
const ranking = {
  gameId, homeTeamId: homeId, awayTeamId: awayId,
  homeRank: 10, awayRank: 3, capturedAt: "2026-10-27T23:10:00.000Z",
};

test("ranking upset uses the immutable pregame ranks and requires a six-place gap", () => {
  const result = detectRankingUpset(game, ranking);
  assert.equal(result.type, "RANK_UPSET");
  assert.equal(result.title, "Překvapení kola");
  assert.equal(result.facts.rankDifference, 7);
  assert.match(result.text, /LEV \(#10\).*VOHOLTO \(#3\)/);
  assert.equal(detectRankingUpset(game, { ...ranking, homeRank: 8 }), null);
  assert.equal(detectRankingUpset({ ...game, teamStats: game.teamStats.map((t) => ({ ...t, goals: 3 })) }, ranking), null);
  assert.equal(detectRankingUpset(game, { ...ranking, awayTeamId: id("9") }), null);
  assert.equal(detectRankingUpset(game, { ...ranking, homeRank: 12 }).title, "Šok kola");
});

test("daily capture reads one official table per scope and stores only not-started fixtures", async () => {
  const date = "2026-10-28";
  const fixtures = [
    { gameId, organizationId: PHM_ORGANIZATION_ID, startDate: date, status: "NOT PLAYED" },
    { gameId: secondGameId, organizationId: PHM_ORGANIZATION_ID, startDate: date, status: "FINISHED" },
  ];
  let standingsReads = 0, savedRows;
  const result = await capturePregameRankings("PHM", {
    env: { HMS_API_TOKEN: "token" }, date, now: new Date("2026-10-27T23:10:00Z"),
    fetchGames: async () => fixtures,
    fetchDetail: async (requested) => ({
      gameId: requested, organizationId: PHM_ORGANIZATION_ID, startDate: date, startTime: "20:30",
      competitionId, seasonId, groupId, phaseId, homeTeamId: homeId, awayTeamId: awayId,
    }),
    readStandings: async () => {
      standingsReads++;
      return [
        { id: awayId, rank: 3, points: 18, games: 8 },
        { id: homeId, rank: 10, points: 7, games: 8 },
      ];
    },
    save: async (rows) => { savedRows = rows; return rows.length; },
  });
  assert.equal(result.games, 1);
  assert.equal(result.saved, 1);
  assert.equal(standingsReads, 1);
  assert.equal(savedRows[0].homeRank, 10);
  assert.equal(savedRows[0].awayRank, 3);
  assert.equal(savedRows[0].capturedAt, "2026-10-27T23:10:00.000Z");
});

test("public game model exposes only validated rank context", () => {
  const safe = publicPregameRanking(gameId, homeId, awayId, {
    ...ranking, homePoints: 7, awayPoints: 18, homeGames: 8, awayGames: 8, private: "hidden",
  });
  assert.deepEqual(Object.keys(safe).sort(), ["awayGames", "awayPoints", "awayRank", "capturedAt", "homeGames", "homePoints", "homeRank", "source"].sort());
  assert.equal(publicPregameRanking(gameId, homeId, id("9"), ranking), null);
});

test("database keeps the first pregame snapshot instead of rewriting history", async () => {
  let call;
  const row = {
    ...ranking, organizationId: PHM_ORGANIZATION_ID, competitionId, seasonId, groupId, phaseId,
    scheduledOn: "2026-10-28", scheduledTime: "20:30", homePoints: 7, awayPoints: 18,
    homeGames: 8, awayGames: 8,
  };
  const saved = await savePregameRankings([row], {
    ensureSchema: false,
    sql: { query: async (text, values) => { call = { text, values }; return [{ game_id: gameId }]; } },
  });
  assert.equal(saved, 1);
  assert.match(call.text, /on conflict \(game_id\) do nothing/);
  assert.doesNotMatch(call.text, /do update/i);
  assert.ok(call.values.includes(homeId));
});

test("cron endpoint requires Vercel's bearer secret", async () => {
  const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const env = { CRON_SECRET: "1234567890abcdef" };
  const handler = createPregameRankingsHandler({ env, capture: async () => ({ saved: 2 }) });
  let res = response();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.code, 401);
  res = response();
  await handler({ method: "GET", headers: { authorization: `Bearer ${env.CRON_SECRET}` } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.saved, 2);
});
