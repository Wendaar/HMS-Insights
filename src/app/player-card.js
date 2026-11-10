import {pointRanks} from '../domain/player-rankings.js';
import { isGameId } from '../domain/game-summary.js';
import { loadGameSnapshot,loadPlayerSeasonRecords } from '../infrastructure/postgres-repository.js';
import {readOfficialStatistics} from './broadcast-league.js';
const number=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const text=value=>typeof value==='string'?value.slice(0,160):null;

export function playerCard(rows,playerId,scope,{role='skater',source='hms',asOf=new Date().toISOString()}={}) {
  if(!Array.isArray(rows))return null;
  const grouped=new Map(),singleRows=new Map();
  const fields=role==='goalie'?['GP','Svs','GA','SO','PIM','W','D','L']:['GP','G','A','P','PIM','PPG','SHG','Stars'];
  for(const row of rows){
    if(!isGameId(row.PlayerId))continue;
    const id=row.PlayerId.toLowerCase();
    singleRows.set(id,singleRows.has(id)?null:row);
    if(!grouped.has(id))grouped.set(id,{id,name:[text(row.FirstName),text(row.LastName)].filter(Boolean).join(' '),team:text(row.Team),stats:{}});
    const player=grouped.get(id);
    for(const key of fields){const value=key==='P'&&number(row.P)===null&&number(row.G)!==null&&number(row.A)!==null?number(row.G)+number(row.A):number(row[key]);if(value!==null)player.stats[key]=(player.stats[key]??0)+value;}
  }
  const players=[...grouped.values()];
  players.sort((a,b)=>(b.stats.P??-1)-(a.stats.P??-1)||(b.stats.G??-1)-(a.stats.G??-1));
  const ranks=pointRanks(players.map(p=>({id:p.id,points:p.stats.P,goals:p.stats.G})));
  for(const player of players)player.rank=role==='skater'?ranks.get(player.id)??null:null;
  const player=players.find(p=>same(p.id,playerId));
  if(!player)return null;
  if(role==='goalie'){
    const official=singleRows.get(player.id),gaa=number(official?.GAA),sv=number(official?.SvP);
    if(gaa!==null)player.stats.GAA=gaa;
    const shots=player.stats.Svs!=null&&player.stats.GA!=null?player.stats.Svs+player.stats.GA:null;
    if(sv!==null&&sv<=100)player.stats.SvP=sv;
    else if(shots>0)player.stats.SvP=Math.round(player.stats.Svs/shots*10000)/100;
  }
  return {available:true,...player,role,scope:{competition:text(scope.competition_name),season:text(scope.season_name),group:text(scope.group_name)},source,asOf};
}

export async function publicStats(groupId,role,options={}){
  if(!isGameId(groupId))return null;
  try{
    const rows=await readOfficialStatistics({groupId},role,options);
    if(!Array.isArray(rows))return null;
    return rows;
  }catch{return null;}
}

export async function getPlayerCard(gameId,playerId,options={}){
  const snapshot=await(options.loadSnapshot??loadGameSnapshot)(gameId,options);
  if(!snapshot)return null;
  const skater=snapshot.players?.find(p=>same(p.player_id,playerId));
  const keeper=snapshot.goalies?.find(p=>same(p.player_id,playerId));
  if(!skater&&!keeper)return null;
  const role=keeper?'goalie':'skater';
  const rows=await publicStats(snapshot.game.group_id,role,options);
  const official=playerCard(rows,playerId,snapshot.game,{role,source:'hms'});
  if(official)return official;
  const local=await(options.loadRecords??loadPlayerSeasonRecords)(gameId,role,options);
  return playerCard(local,playerId,snapshot.game,{role,source:'imported-games'})??{available:false,id:playerId,name:skater?.player_name??keeper?.player_name};
}
