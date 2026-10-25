import {organizationConfig} from './organizations.js';
import {fetchGames,hmsConfigFromEnv} from '../hms/client.js';
import {gameRows} from './backfill-finished-games.js';
import {isGameId} from '../domain/game-summary.js';
import {periods,normalizeGame,dateValid} from '../../public/operations/model.js';
export async function readOperations(query,options={}){
 const env=options.env??process.env,org=organizationConfig(query.org,env),windows=periods(query.from,query.to);
 if(!org.token)throw new Error('HMS connection unavailable');
 const rules=JSON.parse(env[`HMS_${org.code}_OPERATIONS_RULES`]||'{}');
 const config={...hmsConfigFromEnv({...env,HMS_API_TOKEN:org.token}),timeoutMs:5000,retries:0,signal:AbortSignal.timeout(22000)};
 const games=new Map(),limit=100;
 for(let skip=0;skip<=1000;skip+=limit){
  const rows=gameRows(await(options.fetchGames??fetchGames)({from:windows.previous.from,to:windows.next.to,status:'ALL',limit,skip},{config}));
  if(rows.length>limit||skip+rows.length>1000)throw new Error('Range too large');
  for(const g of rows){
   if(String(g.organizationId).toLowerCase()!==org.id.toLowerCase()||!isGameId(g.gameId)||!dateValid(g.startDate)||g.startDate<windows.previous.from||g.startDate>windows.next.to)throw new Error('Invalid source scope');
   if(g.isDeleted)continue;
   const id=g.gameId.toLowerCase();if(games.has(id))throw new Error('Duplicate source page');
   games.set(id,normalizeGame(g,rules));
  }
  if(rows.length<limit)return {org:org.code,games:[...games.values()],windows,complete:true,source:'HMS API',readAt:new Date().toISOString(),mapping:{cash:!!rules.cashPath,paid:!!rules.paidPath},timezone:'Europe/Prague'};
 }
 throw new Error('Incomplete source');
}
