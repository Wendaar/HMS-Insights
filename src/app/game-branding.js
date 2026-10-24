import {organizationForId} from './organizations.js';
import {fetchGameDetail,hmsConfigFromEnv} from '../hms/client.js';
import {hmsMediaContext} from '../hms/media-context.js';
const cache=new Map();
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
// Optional read-only presentation refresh. Never imports a game or changes its stats.
export async function currentGameBranding(snapshot,options={}){
  const game=snapshot.game,org=organizationForId(game.organization_id,options.env??process.env);
  if(!org?.token)return null;
  const key=org.id.toLowerCase()+':'+game.game_id.toLowerCase(),cached=cache.get(key);
  if(!options.fetchBrandingDetail&&cached?.until>Date.now())return cached.value;
  let value=null;
  try{
    const detail=await(options.fetchBrandingDetail??fetchGameDetail)(game.game_id,{config:{...hmsConfigFromEnv({...(options.env??process.env),HMS_API_TOKEN:org.token}),timeoutMs:4000,retries:0}});
    if(same(detail.gameId,game.game_id)&&same(detail.organizationId,org.id)&&same(detail.homeTeamId??detail.HomeTeam?.teamId,game.home_team_id)&&same(detail.awayTeamId??detail.AwayTeam?.teamId,game.away_team_id)){
      const b=hmsMediaContext(detail);
      value={groupLogoUrl:b.groupName===game.group_name?b.groupLogoUrl:null,competitionLogoUrl:b.competitionName===game.competition_name?b.competitionLogoUrl:null};
    }
  }catch{/* Keep stored logos if HMS is unavailable; never expose upstream errors. */}
  if(!options.fetchBrandingDetail){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+(value?120000:30000)});}
  return value;
}
