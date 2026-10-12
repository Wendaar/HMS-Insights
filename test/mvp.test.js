import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHmsResponses } from "../src/app/analyze.js";
import { gameEventsResponse, lineupResponse, ids } from "../src/fixtures/real-game-sanitized.js";
import { rowsFor } from "../src/infrastructure/supabase-repository.js";
import { feedDemo } from "../src/app/feed-demo.js";
import { renderPriklepyPage } from "../src/web/render.js";
import { endpoint } from "../src/hms/client.js";
import { buildUpsert, publicFeedItem } from "../src/infrastructure/postgres-repository.js";
import { processFinishedGame } from "../src/app/process-finished-game.js";
import { loadFeedForRequest } from "../src/web/feed-loader.js";

const analysis = analyzeHmsResponses(gameEventsResponse, lineupResponse);

test("normalizuje reálný dokončený zápas", () => {
  assert.equal(analysis.game.gameId, ids.game);
  assert.equal(analysis.game.homeScore, 9);
  assert.equal(analysis.game.awayScore, 3);
  assert.equal(analysis.game.teamStats[0].lineupSize, 11);
  assert.equal(analysis.game.teamStats[1].lineupSize, 14);
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

test("PostgreSQL upsert používá parametry a přenáší názvy kontextu", () => {
  const query = buildUpsert("games", rowsFor(analysis).games);
  assert.match(query.text, /on conflict \(game_id\)/);
  assert.doesNotMatch(query.text, new RegExp(ids.game, "i"));
  assert.ok(query.values.includes(ids.game));
  assert.ok(query.values.includes("PHM Cup"));
  assert.throws(() => buildUpsert("users", [{}]), /Nepovolená tabulka/);
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
