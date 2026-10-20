import { buildGameSummary, isGameId } from "../domain/game-summary.js";
import { loadGameSnapshot } from "../infrastructure/postgres-repository.js";

export async function getGameSummary(gameId, options = {}) {
  if (!isGameId(gameId)) throw new TypeError("Neplatné gameId.");
  const snapshot = await (options.loadSnapshot ?? loadGameSnapshot)(gameId, options);
  return snapshot ? buildGameSummary(snapshot) : null;
}
