import {currentGameBranding} from './game-branding.js';
import {loadGameSnapshot} from '../infrastructure/postgres-repository.js';
import {buildGameSummary,isGameId} from '../domain/game-summary.js';
import {publicStats,playerCard} from './player-card.js';
import {sportingImage,flickrAlbum,youtubeVideo} from '../../public/game-report-media.js';
const cache=new Map(),same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
async function readPublic(endpoint,id,options){
  try{const r=await(options.fetchImpl??fetch)(`https://api.prod.hms.wootera.net/public/${endpoint}?gameId=${encodeURIComponent(id)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});return r.ok?await r.json():null;}catch{return null;}
}
export function displayExtras(snapshot,game,multimedia,stats){
  const summary=buildGameSummary(snapshot),s=summary;
  // The public endpoint is queried by gameId but normally omits it in the body.
  // Confirm both teams, date and final score in that case; reject conflicting IDs.
  const identity=game?.gameId!=null?same(game.gameId,s.gameId):game?.startDate===s.playedOn&&Number(game?.HomeTeamGoals)===s.home.score&&Number(game?.AwayTeamGoals)===s.away.score;
  const matched=identity&&same(game?.HomeTeam?.teamId,s.home.id)&&same(game?.AwayTeam?.teamId,s.away.id);
  const lineup=matched&&Array.isArray(game.Lineups)?game.Lineups.filter(p=>!p.isDeleted):[];
  const counts={};
  const playerImages={};
  for(const entry of lineup){
    const id=entry.playerId??entry.Player?.playerId;
    if(!isGameId(id)||![s.home.id,s.away.id].some(team=>same(team,entry.teamId)))continue;
    const image=sportingImage(entry.Player?.logoUrl)??sportingImage(entry.Player?.avatarUrl);
    if(image)playerImages[id.toLowerCase()]=image;
  }
  for(const team of [s.home,s.away]){
    const entries=new Map(lineup.filter(p=>same(p.teamId,team.id)&&isGameId(p.playerId??p.Player?.playerId)).map(p=>[(p.playerId??p.Player.playerId).toLowerCase(),p]));
    if(entries.size){const goalies=[...entries].filter(([id,p])=>p.ListPosition?.isGoalie===true||s.goalies.some(k=>same(k.id,id))).length;counts[team.id.toLowerCase()]={skaters:entries.size-goalies,goalies};}
  }
  const stars=[],seen=new Set();
  for(const star of matched&&Array.isArray(game.GameStars)?game.GameStars:[]){
    const id=star.playerId??star.Player?.playerId,teamId=star.teamId;
    if(star.isDeleted||!isGameId(id)||!lineup.some(p=>same(p.playerId??p.Player?.playerId,id)&&same(p.teamId,teamId))||seen.has(id.toLowerCase()))continue;
    seen.add(id.toLowerCase());
    const entry=lineup.find(p=>same(p.playerId??p.Player?.playerId,id));
    const player=[...s.players,...s.goalies].find(p=>same(p.id,id));
    const image=playerImages[id.toLowerCase()]??player?.imageUrl??sportingImage(star.Player?.logoUrl);
    if(image)playerImages[id.toLowerCase()]=image;
    stars.push({...player,id:id.toLowerCase(),teamId:teamId.toLowerCase(),name:player?.name??[star.Player?.firstName,star.Player?.lastName].filter(v=>typeof v==='string').join(' '),imageUrl:image,hasCard:!!player,role:entry.ListPosition?.isGoalie===true||s.goalies.some(k=>same(k.id,id))?'goalie':'skater'});
  }
  const ranks={};
  for(const p of s.players){const card=playerCard(stats,p.id,snapshot.game);if(card?.rank&&card.rank<=10)ranks[p.id.toLowerCase()]=card.rank;}
  return {stars,playerImages,rosterCounts:counts,ranks,media:{albumUrl:s.media.albumUrl??(matched?flickrAlbum(game.flickrAlbum):null)??flickrAlbum(multimedia?.albumUrl)??flickrAlbum(multimedia?.flickrAlbum),youtubeUrl:youtubeVideo(multimedia?.youtubeVideoUrl)??(matched?youtubeVideo(game.youtubeVideoUrl):null)},source:'hms',asOf:new Date().toISOString()};
}
export async function getGameExtras(gameId,options={}){
  if(!isGameId(gameId))throw new TypeError('Invalid game');
  const key=gameId.toLowerCase();if(!options.loadSnapshot&&!options.fetchImpl&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  const snapshot=await(options.loadSnapshot??loadGameSnapshot)(gameId,options);if(!snapshot)return null;
  const [game,media,stats,branding]=await Promise.all([readPublic('game',gameId,options),readPublic('gameMultimedia',gameId,options),publicStats(snapshot.game.group_id,'skater',options),currentGameBranding(snapshot,options)]);
  const value={...displayExtras(snapshot,game,media,stats),branding};
  if(game&&media&&stats&&!options.fetchImpl&&!options.loadSnapshot){if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+120000});}
  return value;
}
