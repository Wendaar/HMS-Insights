import { normalizeHmsGame } from "../hms/normalize.js";
import { detectPriklepy } from "../domain/rules.js";

export function analyzeHmsResponses(gameResponse, lineupResponse) {
  const game = normalizeHmsGame(gameResponse, lineupResponse);
  const priklepy = detectPriklepy(game);
  return { game, priklepy };
}

