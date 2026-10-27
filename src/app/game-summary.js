import {organizationForId} from './organizations.js';
import { buildGameSummary, isGameId } from "../domain/game-summary.js";
import { loadGameSnapshot, loadPregameRanking } from "../infrastructure/postgres-repository.js";

export async function getGameSummary(gameId, options = {}) {
  if (!isGameId(gameId)) throw new TypeError("Neplatné gameId.");
  const snapshot = await (options.loadSnapshot ?? loadGameSnapshot)(gameId, options);
  if(!snapshot)return null;
  let pregameRanking=null;
  if((options.env??process.env).DATABASE_URL)try{pregameRanking=await (options.loadRanking??loadPregameRanking)(gameId,options);}catch{/* Ranking is optional sporting context. */}
  const org=organizationForId(snapshot.game.organization_id,options.env??process.env);
  return {...buildGameSummary({...snapshot,pregameRanking}),insightsPath:org?'/priklepy/'+org.slug:null};
}
