import {organizationForId} from './organizations.js';
import { buildGameSummary, isGameId } from "../domain/game-summary.js";
import { loadGameSnapshot } from "../infrastructure/postgres-repository.js";

export async function getGameSummary(gameId, options = {}) {
  if (!isGameId(gameId)) throw new TypeError("Neplatné gameId.");
  const snapshot = await (options.loadSnapshot ?? loadGameSnapshot)(gameId, options);
  if(!snapshot)return null;
  const org=organizationForId(snapshot.game.organization_id,options.env??process.env);
  return {...buildGameSummary(snapshot),insightsPath:org?'/priklepy/'+org.slug:null};
}
