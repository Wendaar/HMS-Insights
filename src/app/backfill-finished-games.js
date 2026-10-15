import { fetchGames } from "../hms/client.js";
import { processFinishedGame } from "./process-finished-game.js";

function gameRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["games", "items", "data", "rows"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error("HMS /games nevrátil očekávaný seznam zápasů.");
}

function pause(milliseconds) {
  return milliseconds > 0
    ? new Promise((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve();
}

export async function backfillFinishedGames(options = {}) {
  const loadGames = options.loadGames ?? fetchGames;
  const processGame = options.processGame ?? processFinishedGame;
  const limit = Math.min(Math.max(Number(options.limit ?? 500), 1), 500);
  const intervalMs = Math.max(Number(options.intervalMs ?? 1550), 0);
  let skip = Math.max(Number(options.skip ?? 0), 0);
  let discovered = 0;
  let processed = 0;
  const failures = [];

  while (true) {
    const page = gameRows(await loadGames({
      status: "FINISHED",
      seasonId: options.seasonId,
      changedSince: options.changedSince,
      limit,
      skip,
    }, options));
    discovered += page.length;

    for (const game of page) {
      const gameId = game.gameId ?? game.id;
      try {
        await processGame(gameId, {
          ...options,
          expectedOrganizationId: game.organizationId ?? options.organizationId,
        });
        processed += 1;
        await options.onProgress?.({ gameId, processed, discovered, failed: failures.length });
      } catch (error) {
        failures.push({ gameId, error: error.message });
        await options.onProgress?.({ gameId, processed, discovered, failed: failures.length });
      }
      await pause(intervalMs);
    }

    if (page.length < limit) break;
    skip += limit;
  }

  return { discovered, processed, failed: failures.length, failures };
}

export { gameRows };
