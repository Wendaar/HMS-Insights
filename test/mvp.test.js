import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHmsResponses } from "../src/app/analyze.js";
import { gameEventsResponse, lineupResponse, ids } from "../src/fixtures/real-game-sanitized.js";
import { rowsFor } from "../src/infrastructure/supabase-repository.js";
import { feedDemo } from "../src/app/feed-demo.js";
import { renderPriklepyPage } from "../src/web/render.js";

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
});
