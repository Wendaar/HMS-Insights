import { analyzeHmsResponses } from "./analyze.js";
import { fetchFinishedGameResponses } from "../hms/client.js";
import { persistAnalysisPostgres } from "../infrastructure/postgres-repository.js";

export async function processFinishedGame(gameId, options = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(gameId ?? "")) throw new Error("Neplatné gameId.");
  const fetchResponses = options.fetchResponses ?? fetchFinishedGameResponses;
  const persist = options.persist ?? persistAnalysisPostgres;
  const [gameEvents, lineup] = await fetchResponses(gameId, options);
  const analysis = analyzeHmsResponses(gameEvents, lineup);
  if (analysis.game.gameId.toLowerCase() !== gameId.toLowerCase()) {
    throw new Error("HMS API vrátilo jiný zápas, než požadoval webhook.");
  }
  await persist(analysis, options);
  return {
    gameId: analysis.game.gameId,
    score: `${analysis.game.homeScore}:${analysis.game.awayScore}`,
    priklepy: analysis.priklepy.length,
  };
}
