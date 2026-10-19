import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sampleAnalysis } from "./app/sample.js";
import { feedDemo } from "./app/feed-demo.js";
import { renderPriklepyPage } from "./web/render.js";
import { createGameReportHandler } from "./web/game-report-handler.js";
import { getGameSummary } from "./app/game-summary.js";
import { buildGameSummary } from "./domain/game-summary.js";
import { rowsFor } from "./infrastructure/analysis-rows.js";
import { analyzeHmsResponses } from "./app/analyze.js";
import { gameEvents as zbraslavEvents, lineup as zbraslavLineup } from "./fixtures/zbraslav-kosti.js";

const directory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(directory, "..", "public");
const port = Number(process.env.PORT ?? 3000);
const zbraslavAnalysis = analyzeHmsResponses(zbraslavEvents, zbraslavLineup);

const assets = {
  "/styles.css": ["text/css; charset=utf-8", "styles.css"],
  "/app.js": ["text/javascript; charset=utf-8", "app.js"],
  "/game-report.js": ["text/javascript; charset=utf-8", "game-report.js"],
  "/game-report-data.js": ["text/javascript; charset=utf-8", "game-report-data.js"],
  "/game-report.css": ["text/css; charset=utf-8", "game-report.css"],
  "/favicon.svg": ["image/svg+xml", "favicon.svg"],
};

export const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const reportMatch = /^\/game-center\/([^/]+)$/.exec(url.pathname);
  if (reportMatch || url.pathname === "/api/game-summary") {
    request.query = { gameId: reportMatch?.[1] ?? url.searchParams.get("gameId") };
    const adapter = {
      setHeader: (key, value) => response.setHeader(key, value),
      status(code) { response.statusCode = code; return this; },
      send(body) { response.end(body); },
      json(body) { response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify(body)); },
    };
    const loadSummary = process.env.DATABASE_URL ? getGameSummary : async (gameId) => {
      const preview = [zbraslavAnalysis, sampleAnalysis].find((item) => item.game.gameId.toLowerCase() === gameId.toLowerCase());
      if (!preview) return null;
      const rows = rowsFor(preview);
      return buildGameSummary({ game: rows.games[0], teams: rows.team_game_stats,
        players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy });
    };
    await createGameReportHandler({ json: !reportMatch, loadSummary, preview: !process.env.DATABASE_URL })(request, adapter);
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(302, { location: "/priklepy" });
    response.end();
    return;
  }
  if (url.pathname === "/priklepy") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderPriklepyPage(feedDemo));
    return;
  }
  if (url.pathname === "/api/priklepy") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(sampleAnalysis));
    return;
  }
  if (url.pathname === "/api/feed") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(feedDemo));
    return;
  }
  if (assets[url.pathname]) {
    const [contentType, filename] = assets[url.pathname];
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(await readFile(join(publicDirectory, filename)));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Nenalezeno");
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`HMS Insights běží na http://localhost:${port}/priklepy`));
}
