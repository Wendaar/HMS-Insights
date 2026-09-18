import { readFile } from "node:fs/promises";
import { analyzeHmsResponses } from "../src/app/analyze.js";
import { persistAnalysis } from "../src/infrastructure/supabase-repository.js";

const args = process.argv.slice(2);
const persist = args.includes("--persist");
const files = args.filter((item) => item !== "--persist");

if (files.length !== 2) {
  console.error("Použití: node scripts/ingest.js game-events.json lineup.json [--persist]");
  process.exitCode = 1;
} else {
  const [gameResponse, lineupResponse] = await Promise.all(
    files.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );
  const analysis = analyzeHmsResponses(gameResponse, lineupResponse);
  if (persist) await persistAnalysis(analysis);
  console.log(JSON.stringify({
    persisted: persist,
    game: {
      gameId: analysis.game.gameId,
      score: `${analysis.game.teamStats[0].teamName} ${analysis.game.homeScore}:${analysis.game.awayScore} ${analysis.game.teamStats[1].teamName}`,
    },
    counts: {
      playerStats: analysis.game.playerStats.length,
      goalieStats: analysis.game.goalieStats.length,
      teamStats: analysis.game.teamStats.length,
      priklepy: analysis.priklepy.length,
    },
    priklepy: analysis.priklepy,
  }, null, 2));
}

