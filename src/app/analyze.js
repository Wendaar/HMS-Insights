import { normalizeHmsGame } from "../hms/normalize.js";
import { detectPriklepy } from "../domain/rules.js";

export function analyzeHmsResponses(gameEventsResponse, lineupResponse, gameDetailResponse = null, publicMetadata = null) {
  const game = normalizeHmsGame(gameEventsResponse, lineupResponse, gameDetailResponse, publicMetadata);
  const priklepy = detectPriklepy(game);
  return { game, priklepy };
}

