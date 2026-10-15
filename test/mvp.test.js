import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHmsResponses } from "../src/app/analyze.js";
import { gameEventsResponse, lineupResponse, ids } from "../src/fixtures/real-game-sanitized.js";
import { rowsFor } from "../src/infrastructure/supabase-repository.js";
import { feedDemo } from "../src/app/feed-demo.js";
import { renderPriklepyPage } from "../src/web/render.js";
import { apiUrl, endpoint, fetchFinishedGameResponses } from "../src/hms/client.js";
import { buildUpsert, dateOnly, ensurePenaltyMinutesSchema, persistAnalysisPostgres, publicFeedItem } from "../src/infrastructure/postgres-repository.js";
import { processFinishedGame } from "../src/app/process-finished-game.js";
import { loadFeedForRequest } from "../src/web/feed-loader.js";
import { backfillFinishedGames, backfillFinishedGamesPage } from "../src/app/backfill-finished-games.js";
import { hasBearerSecret } from "../src/security/bearer-secret.js";
import importGamePageHandler from "../api/import-game-page.js";
import backfillPageHandler from "../api/backfill-page.js";
import { penaltyMinutes } from "../src/hms/normalize.js";

const analysis = analyzeHmsResponses(gameEventsResponse, lineupResponse);
const nestedGroup = lineupResponse.Phase.Group;
const nestedSeason = nestedGroup.Season;
const publicApiDetail = {
  gameId: ids.game,
  organizationId: ids.org,
  status: "FINISHED",
  startDate: gameEventsResponse.startDate,
  startTime: gameEventsResponse.startTime,
  homeTeamId: ids.home,
  awayTeamId: ids.away,
  HomeTeamGoals: 9,
  AwayTeamGoals: 3,
  HomeTeam: gameEventsResponse.GameEventGoals.find((item) => item.scoredByTeamId === ids.home).ScoredByTeam,
  AwayTeam: gameEventsResponse.GameEventGoals.find((item) => item.scoredByTeamId === ids.away).ScoredByTeam,
  Venue: lineupResponse.Venue,
  Phase: { phaseId: ids.phase, name: lineupResponse.Phase.name },
  Group: { groupId: ids.group, name: nestedGroup.name, color: nestedGroup.color, logoUrl: nestedGroup.logoUrl },
  Season: { seasonId: ids.season, name: nestedSeason.name },
  Competition: { competitionId: ids.competition, name: nestedSeason.Competition.name },
};
const publicApiEvents = {
  gameId: ids.game,
  events: [
    ...gameEventsResponse.GameEventGoals.map((item) => ({
      type: "goal", eventId: item.gameEventGoalId, gameTime: item.gameTime, period: item.period,
      scoredByPlayerId: item.scoredByPlayerId, scoredByTeamId: item.scoredByTeamId,
      assistedBy1PlayerId: item.assistedBy1PlayerId, assistedBy2PlayerId: item.assistedBy2PlayerId,
      allowedByPlayerId: item.allowedByPlayerId,
    })),
    ...gameEventsResponse.GameEventSaves.map((item) => ({
      type: "save", eventId: item.gameEventSaveId, savedByPlayerId: item.savedByPlayerId,
      savedByTeamId: item.savedByTeamId,
    })),
    ...gameEventsResponse.GameEventPenalties.map((item) => ({ type: "penalty", ...item })),
  ],
};
const publicApiLineup = lineupResponse.Lineups.map((item) => ({
  ...item,
  ListPosition: { ...item.ListPosition, isGoalie: null },
}));

test("normalizuje reálný dokončený zápas", () => {
  assert.equal(analysis.game.gameId, ids.game);
  assert.equal(analysis.game.homeScore, 9);
  assert.equal(analysis.game.awayScore, 3);
  assert.equal(analysis.game.teamStats[0].lineupSize, 11);
  assert.equal(analysis.game.teamStats[1].lineupSize, 14);
});

test("normalizuje současný veřejný formát HMS se společným seznamem událostí", () => {
  const result = analyzeHmsResponses(publicApiEvents, publicApiLineup, publicApiDetail);
  assert.equal(result.game.homeScore, 9);
  assert.equal(result.game.awayScore, 3);
  assert.equal(result.game.goals[0].playerName, "Mansur Ischoev");
  assert.equal(result.game.goals[0].gameTime, "0:43");
  assert.deepEqual(result.game.goalieStats.map((item) => item.saves).sort((a, b) => b - a), [34, 31]);
  assert.equal(result.priklepy.length, 10);
});

test("oficiálně přepsané skóre má přednost před neúplnými událostmi", () => {
  const result = analyzeHmsResponses(
    { ...publicApiEvents, events: publicApiEvents.events.filter((item) => item.type !== "goal") },
    publicApiLineup,
    publicApiDetail,
  );
  assert.equal(result.game.homeScore, 9);
  assert.equal(result.game.awayScore, 3);
  assert.equal(result.game.scoreWasOverridden, true);
  assert.equal(result.priklepy.filter((item) => item.playerId).length, 0);
});

test("gól bez času se započítá, ale nevytvoří rychlý Příklep", () => {
  const untimedGoalId = publicApiEvents.events.find((item) => item.type === "goal").eventId;
  const events = publicApiEvents.events.map((item) => (
    item.eventId === untimedGoalId ? { ...item, gameTime: null } : item
  ));
  const result = analyzeHmsResponses({ ...publicApiEvents, events }, publicApiLineup, publicApiDetail);
  assert.equal(result.game.homeScore, 9);
  assert.equal(result.game.awayScore, 3);
  assert.equal(result.game.goals.find((item) => item.eventId === untimedGoalId).elapsedSeconds, null);
  assert.equal(result.priklepy.some((item) => item.type === "EARLY_GOAL"), false);
});

test("Quick SAVE bez hráče nevytvoří anonymního gólmana ani nezastaví import", () => {
  const events = [...publicApiEvents.events, {
    type: "save",
    eventId: "quick-save-without-goalie",
    savedByPlayerId: null,
    savedByTeamId: ids.home,
  }];
  const result = analyzeHmsResponses({ ...publicApiEvents, events }, publicApiLineup, publicApiDetail);
  assert.equal(result.game.goalieStats.some((item) => !item.playerId), false);
  assert.deepEqual(result.game.goalieStats.map((item) => item.saves).sort((a, b) => b - a), [34, 31]);
});

test("časová délka trestu z veřejného API se převede na přesné minuty", () => {
  assert.equal(penaltyMinutes("1:45"), 1.75);
  assert.equal(penaltyMinutes("00:02:00"), 2);
  assert.equal(penaltyMinutes("2:00"), 2);
  assert.equal(penaltyMinutes("20:00"), 20);
  assert.equal(penaltyMinutes("2"), 2);
  assert.throws(() => penaltyMinutes("neplatné"), /Neplatná délka trestu/);
});

test("databázová migrace povolí desetinné trestné minuty jen když je potřeba", async () => {
  const queries = [];
  const changed = await ensurePenaltyMinutesSchema({
    sql: { query: async (text) => { queries.push(text); return queries.length === 1 ? [{ data_type: "integer" }] : []; } },
  });
  assert.equal(changed, true);
  assert.match(queries[1], /numeric\(10,6\)/);

  const unchanged = await ensurePenaltyMinutesSchema({ sql: { query: async () => [{ data_type: "numeric" }] } });
  assert.equal(unchanged, false);
});

test("lineup nemusí opakovat gameId, protože je načten parametrem endpointu", () => {
  const lineupWithoutRepeatedId = { ...lineupResponse };
  delete lineupWithoutRepeatedId.gameId;
  const result = analyzeHmsResponses(gameEventsResponse, lineupWithoutRepeatedId);
  assert.equal(result.game.gameId, ids.game);
});

test("lineup s přítomným cizím gameId je odmítnut", () => {
  assert.throws(
    () => analyzeHmsResponses(gameEventsResponse, { ...lineupResponse, gameId: "11111111-1111-1111-1111-111111111111" }),
    /různým zápasům/,
  );
});

test("první gól dal Mansur Ischoev v 0:43", () => {
  assert.equal(analysis.game.goals[0].playerName, "Mansur Ischoev");
  assert.equal(analysis.game.goals[0].gameTime, "0:43");
});

test("Marek Horáček má 1+3 a čtyři body", () => {
  const marek = analysis.game.playerStats.find((item) => item.playerName === "Marek Horáček");
  assert.deepEqual({ goals: marek.goals, assists: marek.assists, points: marek.points }, { goals: 1, assists: 3, points: 4 });
});

test("gólmani mají 34 a 31 zákroků", () => {
  const saves = analysis.game.goalieStats.map((item) => item.saves).sort((a, b) => b - a);
  assert.deepEqual(saves, [34, 31]);
});

test("detekuje přesně očekávané typy bez hattricku", () => {
  const counts = Object.groupBy(analysis.priklepy, (item) => item.type);
  assert.equal(counts.BIG_WIN.length, 1);
  assert.equal(counts.EARLY_GOAL.length, 1);
  assert.equal(counts.MULTIPOINT_GAME.length, 6);
  assert.equal(counts.BIG_SAVES.length, 2);
  assert.equal(counts.HATTRICK, undefined);
  assert.equal(analysis.priklepy.length, 10);
});

test("databázové řádky obsahují tenant vazby a žádné kontaktní údaje", () => {
  const serialized = JSON.stringify(rowsFor(analysis));
  assert.match(serialized, new RegExp(ids.org, "i"));
  assert.doesNotMatch(serialized, /phone|email|birthday/i);
});

test("normalizace přenáší bezpečné obrazové údaje bez osobních kontaktů", () => {
  const goalie = analysis.game.players.find((item) => item.playerName === "Aleš Hadrbolec");
  const kosti = analysis.game.teamStats.find((item) => item.teamName === "HC Kosti");
  assert.match(goalie.playerImageUrl, /^https:\/\//);
  assert.match(kosti.logoUrl, /^https:\/\//);
  assert.equal(analysis.game.groupColor, "#a454ff");
  assert.equal(analysis.game.venueName, "ICERINK (Yellow)");
  assert.match(analysis.game.groupLogoUrl, /_cropped_md$/);
  assert.match(analysis.game.venueLogoUrl, /_cropped_md$/);
  assert.match(analysis.game.teamStats.find((item) => item.teamName === "PUK PAK PIVO").logoUrl, /_cropped_md$/);
  assert.match(analysis.game.players.find((item) => item.playerName === "Jan Šramota").playerImageUrl, /_cropped_md$/);
});

test("feed kombinuje reálné a jasně označené ukázkové zápasy", () => {
  assert.ok(feedDemo.length > analysis.priklepy.length);
  assert.equal(feedDemo.filter((item) => item.source === "HMS").length, 10);
  assert.ok(feedDemo.some((item) => item.source === "DEMO"));
  assert.match(feedDemo.find((item) => item.source === "HMS").gameDetailUrl, /prod\.hms\.wootera\.net\/embed\/game/);
});

test("ukázkové karty přebírají barvu z definice skupiny", () => {
  assert.equal(feedDemo.find((item) => item.group === "KLASIK").groupColor, "#429BF7");
  assert.equal(feedDemo.find((item) => item.group === "SUPER").groupColor, "#a454ff");
  assert.equal(feedDemo.find((item) => item.group === "SPORT").groupColor, "#554CF6");
});

test("stránka obsahuje vyhledávání, všechny filtry a rozkliknutelné karty", () => {
  const html = renderPriklepyPage(feedDemo);
  assert.match(html, /id="search"/);
  for (const filter of ["season", "group", "teams", "phase", "venue", "sponsor"]) {
    assert.match(html, new RegExp(`data-filter="${filter}"`));
  }
  assert.match(html, /id="detail-dialog"/);
  assert.match(html, /row-team-placeholder/);
});

test("HMS klient bezpečně vloží gameId do smluvené adresy", () => {
  assert.equal(
    endpoint("https://hms.example/games/{gameId}/events", ids.game),
    `https://hms.example/games/${ids.game}/events`,
  );
  assert.throws(() => endpoint("https://hms.example/games/events", ids.game), /\{gameId\}/);
});

test("HMS klient používá produkční v1 endpointy a gameId v query", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    return { ok: true, status: 200, json: async () => ({ gameId: ids.game }) };
  };
  await fetchFinishedGameResponses(ids.game, {
    config: { token: "secret", baseUrl: "https://public-api.prod.hms.wootera.net/api/v1" },
    fetchImpl,
  });
  assert.deepEqual(requested.map((url) => new URL(url).pathname), [
    "/api/v1/game", "/api/v1/gameEvents", "/api/v1/gameLineup",
  ]);
  assert.ok(requested.every((url) => new URL(url).searchParams.get("gameId") === ids.game));
  assert.equal(apiUrl("https://example.test/api/v1", "games", { status: "FINISHED" }).searchParams.get("status"), "FINISHED");
});

test("PostgreSQL upsert používá parametry a přenáší názvy kontextu", () => {
  const query = buildUpsert("games", rowsFor(analysis).games);
  assert.match(query.text, /on conflict \(game_id\)/);
  assert.doesNotMatch(query.text, new RegExp(ids.game, "i"));
  assert.ok(query.values.includes(ids.game));
  assert.ok(query.values.includes("PHM Cup"));
  assert.throws(() => buildUpsert("users", [{}]), /Nepovolená tabulka/);
  assert.throws(
    () => buildUpsert("player_game_stats", [{ game_id: ids.game, pim: Number.NaN }]),
    /player_game_stats\.pim/,
  );
});

test("opravený zápas před uložením odstraní starý snapshot a zastaralé Příklepy", async () => {
  const queries = [];
  await persistAnalysisPostgres(analysis, {
    sql: { query: async (text, values) => { queries.push({ text, values }); return []; } },
  });
  assert.equal(queries[0].text, "delete from games where game_id = $1");
  assert.deepEqual(queries[0].values, [ids.game]);
  assert.match(queries[1].text, /^insert into games/);
});

test("game.finished spustí existující parser a uložení právě jednou", async () => {
  let persisted;
  const result = await processFinishedGame(ids.game, {
    fetchResponses: async () => [gameEventsResponse, lineupResponse],
    persist: async (value) => { persisted = value; },
  });
  assert.equal(result.gameId, ids.game);
  assert.equal(result.priklepy, 10);
  assert.equal(persisted.game.homeScore, 9);
});

test("veřejný databázový řádek se mapuje bez soukromých údajů", () => {
  const item = publicFeedItem({
    priklep_id: "x", type: "BIG_WIN", importance: 90, facts: {}, game_id: ids.game,
    played_on: "2026-09-17", home_team_name: "PUK PAK PIVO", away_team_name: "HC Kosti",
    home_score: 9, away_score: 3, team_name: "PUK PAK PIVO", group_color: "#a454ff",
  });
  assert.equal(item.homeScore, 9);
  assert.match(item.gameDetailUrl, new RegExp(ids.game, "i"));
  assert.doesNotMatch(JSON.stringify(item), /email|phone|birthday/i);
});

test("PostgreSQL datum se pro web normalizuje na YYYY-MM-DD", () => {
  assert.equal(dateOnly(new Date("2026-09-17T00:00:00.000Z")), "2026-09-17");
  assert.equal(dateOnly("2026-09-17T00:00:00Z"), "2026-09-17");
  assert.equal(dateOnly("2026-09-17"), "2026-09-17");
  assert.equal(dateOnly(null), null);
});

test("prázdná databáze ponechá demo viditelné, dokud nepřijde první reálný zápas", async () => {
  const feed = await loadFeedForRequest(
    { DATABASE_URL: "postgres://example", ALLOW_DEMO_FEED: "true" },
    { loadFeed: async () => [] },
  );
  assert.equal(feed.mode, "demo");
  assert.equal(feed.items, feedDemo);
});

test("jakmile databáze obsahuje data, mají přednost před ukázkou", async () => {
  const databaseItems = [{ id: "real" }];
  const feed = await loadFeedForRequest(
    { DATABASE_URL: "postgres://example", ALLOW_DEMO_FEED: "true" },
    { loadFeed: async () => databaseItems },
  );
  assert.equal(feed.mode, "database");
  assert.equal(feed.items, databaseItems);
});

test("historický import stránkuje a pokračuje po jednom chybném zápase", async () => {
  const pages = [
    [{ gameId: ids.game, organizationId: ids.org }, { gameId: "11111111-1111-1111-1111-111111111111", organizationId: ids.org }],
    [{ gameId: "22222222-2222-2222-2222-222222222222", organizationId: ids.org }],
  ];
  const processed = [];
  const result = await backfillFinishedGames({
    limit: 2,
    intervalMs: 0,
    loadGames: async ({ skip }) => pages[skip / 2],
    processGame: async (gameId) => {
      if (gameId.startsWith("1111")) throw new Error("test failure");
      processed.push(gameId);
    },
  });
  assert.deepEqual(processed, [ids.game, "22222222-2222-2222-2222-222222222222"]);
  assert.deepEqual({ discovered: result.discovered, processed: result.processed, failed: result.failed }, {
    discovered: 3, processed: 2, failed: 1,
  });
});

test("jedna dávka historického importu vrátí kurzor pro bezpečné pokračování", async () => {
  const requested = [];
  const result = await backfillFinishedGamesPage({
    from: "2026-09-01",
    seasonId: ids.season,
    skip: 10,
    limit: 2,
    intervalMs: 0,
    loadGames: async (params) => {
      requested.push(params);
      return [{ gameId: ids.game, organizationId: ids.org }];
    },
    processGame: async () => {},
  });
  assert.equal(requested[0].from, "2026-09-01");
  assert.equal(requested[0].seasonId, ids.season);
  assert.equal(requested[0].skip, 10);
  assert.deepEqual({ processed: result.processed, nextSkip: result.nextSkip, done: result.done }, {
    processed: 1, nextSkip: 11, done: true,
  });
});

test("ruční import používá secret pouze v autorizační hlavičce", () => {
  assert.equal(hasBearerSecret({ headers: { authorization: "Bearer abc123" } }, "abc123"), true);
  assert.equal(hasBearerSecret({ headers: { authorization: "Bearer špatně" } }, "abc123"), false);
  assert.equal(hasBearerSecret({ headers: {} }, "abc123"), false);
});

test("skript ručního importu je po vyrenderování platný JavaScript", () => {
  let rendered = "";
  const response = {
    setHeader() {},
    status() { return this; },
    send(value) { rendered = value; return value; },
  };
  importGamePageHandler({ method: "GET" }, response);
  const script = rendered.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test("stránka historického importu obsahuje platný dávkový skript", () => {
  let rendered = "";
  const response = {
    setHeader() {},
    status() { return this; },
    send(value) { rendered = value; return value; },
  };
  backfillPageHandler({ method: "GET" }, response);
  const script = rendered.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(script);
  assert.match(rendered, /2026-09-01/);
  assert.match(rendered, new RegExp(ids.season, "i"));
  assert.match(rendered, /CHYBNÉ ZÁPASY/);
  assert.doesNotThrow(() => new Function(script));
});
