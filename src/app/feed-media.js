import {fetchPublicGameMetadata} from '../hms/client.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const image=entity=>sportingImage(entity?.logoUrls?.md)??sportingImage(entity?.logoUrl)??sportingImage(entity?.imageUrls?.md);
const cache=new Map(),pending=new Map();
async function metadata(gameId,options){
 const key=gameId.toLowerCase(),cacheable=!options.fetchMetadata;
 if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
 if(cacheable&&pending.has(key))return pending.get(key);
 if(pending.size>=16)return null;
 const task=(async()=>{
  const value=await(options.fetchMetadata??fetchPublicGameMetadata)(gameId);
  if(cacheable){if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+(value?300000:15000)});}return value;
 })();
 if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
// Refresh only sporting images. IDs and the fixture date protect against media
// from another player/team/game; results and published stories remain untouched.
export async function refreshFeedMedia(items,options={}){
 const ids=[...new Set(items.filter(i=>isGameId(i.gameId)&&(isGameId(i.teamId)||isGameId(i.playerId))).map(i=>i.gameId.toLowerCase()))];
 const games=new Map(await Promise.all(ids.map(async id=>{try{return [id,await metadata(id,options)];}catch{return [id,null];}})));
 return items.map(item=>{
  const game=games.get(item.gameId?.toLowerCase());
  if(!game||game.startDate!==item.date||game.HomeTeam?.name!==item.homeTeam||game.AwayTeam?.name!==item.awayTeam)return item;
  const team=[game.HomeTeam,game.AwayTeam].find(t=>same(t?.teamId,item.teamId));
  const player=game.Lineups?.find(row=>same(row.Player?.playerId,item.playerId)&&same(row.teamId,item.teamId))?.Player;
  return {...item,teamLogoUrl:image(team)??sportingImage(item.teamLogoUrl),playerImageUrl:image(player)??sportingImage(item.playerImageUrl)};
 });
}
