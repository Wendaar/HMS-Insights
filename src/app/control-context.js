import {organizationConfig} from './organizations.js';
import {loadControlLeagues,loadControlGames} from '../infrastructure/postgres-repository.js';
import {isGameId} from '../domain/game-summary.js';
export async function controlContextCatalog(org,options={}){
  const config=organizationConfig(org,options.env??process.env);
  const rows=await(options.loadLeagues??loadControlLeagues)(config.id,options);
  const items=new Map();
  for(const row of rows){
    if(String(row.organization_id).toLowerCase()!==config.id.toLowerCase())throw new Error('Catalog organization mismatch');
    if(!isGameId(row.season_id)||!row.competition_name||!row.season_name)continue;
    items.set(row.season_id.toLowerCase(),{seasonId:row.season_id.toLowerCase(),name:`${String(row.competition_name).slice(0,120)} · ${String(row.season_name).slice(0,80)}`});
  }
  return {org:config.code,items:[...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs')),source:'imported-hms-seasons'};
}
export async function controlGameCatalog(org,seasonId,options={}){
  const config=organizationConfig(org,options.env??process.env);
  if(!isGameId(seasonId))throw new TypeError('Neplatná sezona.');
  const rows=await(options.loadControlGames??loadControlGames)(config.id,seasonId,options);
  const items=rows.map(row=>{
    if(String(row.organization_id).toLowerCase()!==config.id.toLowerCase()||String(row.season_id).toLowerCase()!==seasonId.toLowerCase()||!isGameId(row.game_id))throw new Error('Catalog context mismatch');
    const date=row.played_on instanceof Date?row.played_on.toISOString().slice(0,10):String(row.played_on).slice(0,10);
    return {gameId:row.game_id,seasonId:row.season_id,label:`${String(row.home_team_name??'Domácí').slice(0,120)} — ${String(row.away_team_name??'Hosté').slice(0,120)} · ${date}`};
  });
  return {org:config.code,seasonId,items,source:'imported-hms-games'};
}
