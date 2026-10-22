import { fetchGames } from "../hms/client.js";
import { processFinishedGame } from "./process-finished-game.js";

function gameRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["games", "items", "data", "rows"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error("HMS /games nevrátil očekávaný seznam zápasů.");
}

function assertOrganization(page,options){
  if(options.organizationId&&page.some(game=>typeof game.organizationId!=='string'||game.organizationId.toLowerCase()!==options.organizationId.toLowerCase()))throw new Error('Zdroj neodpovídá organizaci importu.');
  if(options.organizationId&&options.to&&page.some(game=>typeof game.startDate!=='string'||game.startDate<options.from||game.startDate>options.to))throw new Error('Zdroj neodpovídá období importu.');
}

function pause(milliseconds) {
  return milliseconds > 0
    ? new Promise((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve();
}

async function processPage(page, options = {}) {
  const processGame = options.processGame ?? processFinishedGame;
  const intervalMs = Math.max(Number(options.intervalMs ?? 1800), 0);
  assertOrganization(page,options);
  let processed = 0;
  const failures = [];

  for (const game of page) {
    const gameId = game.gameId ?? game.id;
    try {
      await processGame(gameId, {
        ...options,
        expectedOrganizationId: options.organizationId ?? game.organizationId,
      });
      processed += 1;
    } catch (error) {
      failures.push({ gameId, error: error.message });
    }
    await pause(intervalMs);
  }
  return { processed, failures };
}

export async function backfillFinishedGamesPage(options = {}) {
  const loadGames = options.loadGames ?? fetchGames;
  const limit = Math.min(Math.max(Number(options.limit ?? 5), 1), 10);
  const skip = Math.max(Number(options.skip ?? 0), 0);
  const page = gameRows(await loadGames({
    status: "FINISHED",
    seasonId: options.seasonId,
    phaseId: options.phaseId,
    changedSince: options.changedSince,
    from: options.from,
    to: options.to,
    limit,
    skip,
  }, options));
  if(page.length>limit)throw new Error('Zdroj nerespektuje stránkování importu.');
  const result = await processPage(page, options);
  return {
    discovered: page.length,
    processed: result.processed,
    failed: result.failures.length,
    failures: result.failures,
    skip,
    nextSkip: skip + page.length,
    done: page.length < limit,
  };
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
      phaseId: options.phaseId,
      changedSince: options.changedSince,
      from: options.from,
      to: options.to,
      limit,
      skip,
    }, options));
    assertOrganization(page,options);
    discovered += page.length;

    for (const game of page) {
      const gameId = game.gameId ?? game.id;
      try {
        await processGame(gameId, {
          ...options,
          expectedOrganizationId: options.organizationId ?? game.organizationId,
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
