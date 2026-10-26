import {neon} from '@neondatabase/serverless';
import {isGameId} from '../domain/game-summary.js';
import {buildGameTimeline} from '../domain/game-timeline.js';
import {sportingImage} from '../../public/game-report-media.js';
import {browseSeasonGames} from './season-games.js';
const same=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();
const date=v=>v instanceof Date?v.toISOString().slice(0,10):String(v??'').slice(0,10);
const time=v=>{const s=v instanceof Date?v.toISOString():String(v??'');return (/T(\d{2}:\d{2})/.exec(s)??/^(\d{2}:\d{2})/.exec(s))?.[1]??null;};
export function broadcastScope(detail){
  const group=detail.Group??detail.Phase?.Group,season=detail.Season??group?.Season,competition=detail.Competition??season?.Competition;
  const id=v=>isGameId(v)?v.toLowerCase():null;
  return {organizationId:id(detail.organizationId),seasonId:id(detail.seasonId??season?.seasonId),competitionId:id(detail.competitionId??competition?.competitionId),groupId:id(detail.groupId??group?.groupId),phaseId:id(detail.phaseId??detail.Phase?.phaseId),season:season?.name??null,competition:competition?.name??null,group:group?.name??null,phase:detail.Phase?.name??null};
}
export async function loadBroadcastHistory(detail,options={}){
  const scope=broadcastScope(detail);if(!scope.organizationId||!scope.seasonId||!scope.competitionId)throw new Error('Missing scope');
  const sql=options.sql??neon((options.env??process.env).DATABASE_URL);
  // Read-only, exact season/competition/org and before the selected fixture. No player contact fields.
  const rows=await sql.query(`SELECT to_jsonb(g) as game,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.player_id,'teamId',p.team_id,'name',p.player_name,'goals',p.goals,'assists',p.assists,'image',coalesce(p.player_image_url,p.player_image_template_url))) FROM player_game_stats p WHERE p.game_id=g.game_id), '[]'::jsonb) as players
    FROM games g WHERE g.organization_id=$1::uuid AND g.season_id=$2::uuid AND g.competition_id=$3::uuid AND g.status='FINISHED'
    AND g.game_id<>$4::uuid AND (g.played_on<$5::date OR (g.played_on=$5::date AND g.started_at::time<$6::time))
    AND (g.home_team_id=ANY($7::uuid[]) OR g.away_team_id=ANY($7::uuid[])) ORDER BY g.played_on DESC,g.started_at DESC,g.game_id LIMIT 500`,
    [scope.organizationId,scope.seasonId,scope.competitionId,detail.gameId,detail.startDate,detail.startTime??'00:00:00',[detail.homeTeamId??detail.HomeTeam?.teamId,detail.awayTeamId??detail.AwayTeam?.teamId]]);
  return rows;
}
export function summarizeBroadcastHistory(rows,detail){
  const teams={};
  for(const [side,id] of [['home',detail.homeTeamId??detail.HomeTeam?.teamId],['away',detail.awayTeamId??detail.AwayTeam?.teamId]]){
    const games=rows.filter(r=>same(r.game.organization_id,detail.organizationId)&&same(r.game.season_id,broadcastScope(detail).seasonId)&&same(r.game.competition_id,broadcastScope(detail).competitionId)&&!same(r.game.game_id,detail.gameId)&&r.game.status==='FINISHED'&&(date(r.game.played_on)<detail.startDate||date(r.game.played_on)===detail.startDate&&time(r.game.started_at)&&time(r.game.started_at)<String(detail.startTime??'00:00').slice(0,5))&&[r.game.home_team_id,r.game.away_team_id].some(t=>same(t,id)));
    const players=new Map();let covered=0;const totals={goals:0,opportunities:0,conceded:0,shorthanded:0};
    const results=[];let wins=0,draws=0,losses=0;
    for(const row of games){
      const g=row.game,home=same(g.home_team_id,id),gf=Number(home?g.home_score:g.away_score),ga=Number(home?g.away_score:g.home_score);
      if(!Number.isSafeInteger(gf)||!Number.isSafeInteger(ga)||gf<0||ga<0)continue;
      if(gf>ga)wins++;else if(gf===ga)draws++;else losses++;
      results.push({id:g.game_id,date:date(g.played_on),home:{name:g.home_team_name,score:Number(g.home_score)},away:{name:g.away_team_name,score:Number(g.away_score)},result:gf>ga?'W':gf===ga?'D':'L'});
      for(const p of row.players??[]){
        if(!same(p.teamId,id)||!isGameId(p.id))continue;
        const key=p.id.toLowerCase(),old=players.get(key)??{id:p.id,name:String(p.name??'').slice(0,160),goals:0,assists:0,games:0,imageUrl:sportingImage(p.image)};
        if(!Number.isSafeInteger(Number(p.goals))||Number(p.goals)<0||!Number.isSafeInteger(Number(p.assists))||Number(p.assists)<0)continue;
        old.goals+=Number(p.goals);old.assists+=Number(p.assists);old.games++;players.set(key,old);
      }
      const special=buildGameTimeline(g).specialTeams,stats=special?.teams?.[String(id).toLowerCase()];
      if(special?.available&&stats&&stats.opportunities!==null&&stats.shorthanded!==null){covered++;totals.goals+=stats.PP;totals.opportunities+=stats.opportunities;totals.conceded+=stats.concededPP;totals.shorthanded+=stats.shorthanded;}
    }
    results.sort((a,b)=>b.date.localeCompare(a.date));
    teams[side]={games:results.length,wins,draws,losses,results:results.slice(0,5),players:[...players.values()].map(p=>({...p,points:p.goals+p.assists})),specialTeams:{covered,total:games.length,
      // Percentages are only available if every imported game is supported.
      available:games.length>0&&covered===games.length,...totals,
      ppPercentage:covered===games.length&&totals.opportunities?100*totals.goals/totals.opportunities:null,
      pkPercentage:covered===games.length&&totals.shorthanded?100*(1-totals.conceded/totals.shorthanded):null}};
  }
  return teams;
}
const cache=new Map(),pending=new Map();
export async function broadcastContext(detail,options={}){
  const scope=broadcastScope(detail),key=[scope.organizationId,scope.seasonId,scope.competitionId,detail.gameId].join(':');
  if(!options.loadHistory&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  if(!options.loadHistory&&pending.has(key))return pending.get(key);
  if(pending.size>=8)throw new Error('Context busy');
  const task=(async()=>{
    const value={scope,source:'imported-hms',asOf:detail.startDate,historyAvailable:false,teams:null,next:{home:[],away:[]},nextAvailable:false};
    const [history,future]=await Promise.allSettled([
      (options.loadHistory??loadBroadcastHistory)(detail,options),
      scope.seasonId?(options.loadNext??(async()=>{
        const days=Array.from({length:14},(_,i)=>{const d=new Date(detail.startDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
        const all=new Map(),teamIds=[detail.homeTeamId??detail.HomeTeam?.teamId,detail.awayTeamId??detail.AwayTeam?.teamId];let cursor=0;
        await Promise.all(Array.from({length:4},async()=>{while(cursor<days.length){const d=days[cursor++];const pages=await Promise.all(teamIds.map(teamId=>browseSeasonGames({seasonId:scope.seasonId,teamId,filter:'Date',date:d},{...options,loadReports:async()=>[]})));for(const page of pages){if(page.hasMore)throw new Error('Incomplete schedule');for(const g of page.items)all.set(g.id,g);}}}));return [...all.values()];
      }))():Promise.reject(new Error('Missing season')),
    ]);
    if(history.status==='fulfilled'){value.teams=summarizeBroadcastHistory(history.value,detail);value.historyAvailable=true;value.historyTruncated=history.value.length>=500;}
    if(future.status==='fulfilled'){
      for(const [side,id] of [['home',detail.homeTeamId??detail.HomeTeam?.teamId],['away',detail.awayTeamId??detail.AwayTeam?.teamId]])value.next[side]=future.value.filter(g=>!same(g.id,detail.gameId)&&!['CANCELLED','CANCELED','POSTPONED'].includes(g.status)&&[g.home.id,g.away.id].some(t=>same(t,id))&&(g.date>detail.startDate||g.date===detail.startDate&&g.time&&g.time>String(detail.startTime??'').slice(0,5))).sort((a,b)=>(a.date+(a.time??'99:99')).localeCompare(b.date+(b.time??'99:99'))).slice(0,3);
      value.nextAvailable=true;value.nextWindowDays=14;
    }
    if(!options.loadHistory){if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+120000});}return value;
  })();
  if(!options.loadHistory){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
