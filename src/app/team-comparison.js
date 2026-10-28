import {formIndex,teamSpecialTeams,teamRosterTrend,assignTeamRatings} from '../domain/team-performance.js';
import {neon} from '@neondatabase/serverless';
import {organizationConfig} from './organizations.js';
import {controlContextCatalog} from './control-context.js';
import {isGameId} from '../domain/game-summary.js';
import {officialStandings,readComparisonTables} from './broadcast-league.js';
import {sportingImage} from '../../public/game-report-media.js';
const id=v=>isGameId(v)?v.toLowerCase():null;
const count=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const decimal=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const label=v=>typeof v==='string'?v.slice(0,160):'';
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v??'').slice(0,10);
export async function loadComparisonScope(config,seasonId,options={}){
  const sql=options.sql??neon((options.env??process.env).DATABASE_URL);
  return sql.query(`SELECT DISTINCT organization_id,season_id,group_id,group_name,phase_id,phase_name FROM games WHERE organization_id=$1::uuid AND season_id=$2::uuid ORDER BY group_name,phase_name LIMIT 501`,[config.id,seasonId]);
}
export async function loadComparisonGames(config,scope,options={}){
  const sql=options.sql??neon((options.env??process.env).DATABASE_URL);
  return sql.query(`SELECT organization_id,season_id,group_id,phase_id,game_id,status,played_on,started_at,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,event_snapshot,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.player_id,'teamId',p.team_id)) FROM player_game_stats p WHERE p.game_id=games.game_id),'[]'::jsonb) AS skaters FROM games WHERE organization_id=$1::uuid AND season_id=$2::uuid AND group_id=$3::uuid AND phase_id=$4::uuid AND status='FINISHED' ORDER BY played_on DESC,started_at DESC,game_id LIMIT 5001`,[config.id,scope.seasonId,scope.groupId,scope.phaseId]);
}
export async function loadComparisonMeetings(config,scope,teams,options={}){
  const sql=options.sql??neon((options.env??process.env).DATABASE_URL);
  return sql.query(`SELECT organization_id,season_id,game_id,played_on,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,phase_name FROM games WHERE organization_id=$1::uuid AND season_id=$2::uuid AND status='FINISHED' AND home_team_id=ANY($3::uuid[]) AND away_team_id=ANY($3::uuid[]) ORDER BY played_on DESC,started_at DESC,game_id LIMIT 5001`,[config.id,scope.seasonId,teams.map(t=>t.id)]);
}
export function comparisonMeetings(rows,scope,teams){
  if(!Array.isArray(rows)||rows.length>5000)throw new Error('Large meetings');const allowed=new Set(teams.map(t=>t.id)),seen=new Set();
  return rows.map(g=>{
    if(id(g.organization_id)!==id(scope.organizationId)||id(g.season_id)!==id(scope.seasonId)||!id(g.game_id)||seen.has(id(g.game_id))||!allowed.has(id(g.home_team_id))||!allowed.has(id(g.away_team_id))||count(g.home_score)===null||count(g.away_score)===null)throw new Error('Foreign meetings');seen.add(id(g.game_id));
    return {id:id(g.game_id),date:day(g.played_on),phase:label(g.phase_name),home:{id:id(g.home_team_id),name:label(g.home_team_name),score:count(g.home_score)},away:{id:id(g.away_team_id),name:label(g.away_team_name),score:count(g.away_score)}};
  });
}
export async function comparisonCatalog(org,input,options={}){
  if(!id(input.seasonId))throw new TypeError('season');
  const config=organizationConfig(org,options.env??process.env),seasonId=id(input.seasonId);
  const catalog=await (options.catalog??controlContextCatalog)(org,options);
  const season=catalog.items.find(s=>id(s.seasonId)===seasonId);if(!season)throw new TypeError('season');
  const rows=await(options.loadScope??loadComparisonScope)(config,seasonId,options);
  if(!Array.isArray(rows)||rows.length>500)throw new Error('Large scope');
  const groups=new Map();
  for(const r of rows){
    if(id(r.organization_id)!==id(config.id)||id(r.season_id)!==seasonId)throw new Error('Foreign scope');
    if(!id(r.group_id)||!id(r.phase_id))continue;
    const group=groups.get(id(r.group_id))??{id:id(r.group_id),name:label(r.group_name),phases:[]};
    if(!group.phases.some(p=>p.id===id(r.phase_id)))group.phases.push({id:id(r.phase_id),name:label(r.phase_name)});
    groups.set(group.id,group);
  }
  return {org:config.code,season,groups:[...groups.values()]};
}
function penalty(value){
  if(typeof value==='string'&&/^\d{1,6}:[0-5]\d$/.test(value)){const [m,s]=value.split(':').map(Number);return m+s/60;}
  return decimal(value);
}
export function compareTeams(tables,games,scope,{minStarts=null}={}){
  const standings=officialStandings(tables.standings),seen=new Set();
  if(!Array.isArray(games)||games.length>5000)throw new Error('Large history');
  for(const g of games){
    if(id(g.organization_id)!==id(scope.organizationId)||id(g.season_id)!==id(scope.seasonId)||id(g.group_id)!==id(scope.groupId)||id(g.phase_id)!==id(scope.phaseId)||!id(g.game_id)||seen.has(id(g.game_id)))throw new Error('Foreign or duplicate history');
    seen.add(id(g.game_id));
  }
  const teams=standings.map((row,index)=>{
    const score=row.score?.split(':').map(Number),raw=tables.standings[index];
    return {...row,goalsFor:score?.[0]??null,goalsAgainst:score?.[1]??null,pim:penalty(raw['Total Penalty Minutes']),pimDisplay:typeof raw['Total Penalty Minutes']==='string'?raw['Total Penalty Minutes']:decimal(raw['Total Penalty Minutes']),players:[],goalies:[],form:[],metrics:{}};
  });
  const byId=new Map(teams.map(t=>[t.id,t]));
  for(const [kind,rows]of [['players',tables.players],['goalies',tables.goalies]]){
    if(rows!==null&&(!Array.isArray(rows)||rows.length>20000))throw new Error('Large players');
    const keys=new Set();
    for(const r of rows??[]){
      const team=byId.get(id(r.TeamId)),playerId=id(r.PlayerId);if(!team||!playerId)continue;
      const key=team.id+playerId;if(keys.has(key))throw new Error('Duplicate player');keys.add(key);
      const p={id:playerId,name:label([r.FirstName,r.LastName].filter(Boolean).join(' ')),gp:count(r.GP),photo:sportingImage(r.PlayerLogo)};
      if(kind==='players')Object.assign(p,{goals:count(r.G),assists:count(r.A),points:count(r.G)!==null&&count(r.A)!==null?count(r.G)+count(r.A):null});
      else Object.assign(p,{saves:count(r.Svs),ga:count(r.GA),wins:count(r.W),sv:decimal(r.SvP)!==null&&decimal(r.SvP)<=100?decimal(r.SvP):null,gaa:decimal(r.GAA)});
      team[kind].push(p);
    }
  }
  for(const team of teams){
    const history=games.filter(g=>g.status==='FINISHED'&&[id(g.home_team_id),id(g.away_team_id)].includes(team.id)&&count(g.home_score)!==null&&count(g.away_score)!==null);
    const gf=history.reduce((s,g)=>s+Number(id(g.home_team_id)===team.id?g.home_score:g.away_score),0),ga=history.reduce((s,g)=>s+Number(id(g.home_team_id)===team.id?g.away_score:g.home_score),0);
    const wins=history.filter(g=>(id(g.home_team_id)===team.id?Number(g.home_score)>Number(g.away_score):Number(g.away_score)>Number(g.home_score))).length,draws=history.filter(g=>Number(g.home_score)===Number(g.away_score)).length;
    team.history={imported:history.length,expected:team.games,complete:team.games>0&&history.length===team.games&&gf===team.goalsFor&&ga===team.goalsAgainst&&wins===team.wins&&draws===team.draws&&history.length-wins-draws===team.losses};
    history.sort((a,b)=>(day(b.played_on)+String(b.started_at??'')).localeCompare(day(a.played_on)+String(a.started_at??'')));
    if(team.history.complete)team.form=history.slice(0,5).reverse().map(g=>{const home=id(g.home_team_id)===team.id,a=Number(home?g.home_score:g.away_score),b=Number(home?g.away_score:g.home_score);return {id:id(g.game_id),date:day(g.played_on),opponent:label(home?g.away_team_name:g.home_team_name),score:`${a}:${b}`,result:a>b?'W':a===b?'D':'L'};});
    team.players.sort((a,b)=>(b.points??-1)-(a.points??-1)||(b.goals??-1)-(a.goals??-1)||a.name.localeCompare(b.name));
    team.goalies.sort((a,b)=>(b.wins??-1)-(a.wins??-1)||(b.sv??-1)-(a.sv??-1));
    team.uniqueSkaters=tables.players!==null&&team.players.every(p=>p.gp!==null)?team.players.filter(p=>p.gp>0).length:null;
    team.uniqueGoalies=tables.goalies!==null&&team.goalies.every(p=>p.gp!==null)?team.goalies.filter(p=>p.gp>0).length:null;
    team.engagedPlayers=team.uniqueSkaters!==null&&team.uniqueGoalies!==null?new Set([...team.players,...team.goalies].filter(p=>p.gp>0).map(p=>p.id)).size:null;
    team.core=minStarts!==null&&tables.players!==null&&team.players.length>0&&team.players.every(p=>p.gp!==null&&p.gp<=team.games)?team.players.filter(p=>p.gp>=minStarts).length:null;
    team.formRating=formIndex(team.form);
    team.specialTeams=teamSpecialTeams(history,team.id,{complete:team.history.complete,expected:team.games});
    team.roster=teamRosterTrend(history,team.id,{complete:team.history.complete,expected:team.games});
    const defenders=new Set(history.flatMap(g=>g.event_snapshot?.roster??[]).filter(p=>id(p.teamId)===team.id&&p.position==='D'&&p.isGoalie===false).map(p=>id(p.id)));
    team.defenders=team.players.filter(p=>defenders.has(p.id));
    team.pimPerGame=team.games>0&&team.pim!==null?team.pim/team.games:null;
    team.offense=team.games>0&&team.goalsFor!==null?team.goalsFor/team.games:null;
    team.defense=team.games>0&&team.goalsAgainst!==null?team.goalsAgainst/team.games:null;
  }
  // Equal values share a rank. Never change the official HMS table order.
  for(const [metric,dir]of [['offense',-1],['defense',1],['pimPerGame',1]]){
    const eligible=teams.filter(t=>t[metric]!==null&&t.games>0);
    for(const t of eligible)t.metrics[metric]={rank:1+eligible.filter(o=>dir*(o[metric]-t[metric])<0).length,total:eligible.length};
  }
  assignTeamRatings(teams);
  return {teams,playersAvailable:tables.players!==null,goaliesAvailable:tables.goalies!==null,minStarts,rules:'official-phase-v1'};
}
const cache=new Map(),pending=new Map();
export async function readTeamComparison(org,input,options={}){
  const context=await comparisonCatalog(org,input,options),group=context.groups.find(g=>g.id===id(input.groupId)),phase=group?.phases.find(p=>p.id===id(input.phaseId));
  if(!group||!phase)throw new TypeError('scope');
  const minStarts=input.minStarts===undefined||input.minStarts===''?null:Number(input.minStarts);
  if(minStarts!==null&&(!Number.isInteger(minStarts)||minStarts<1||minStarts>200))throw new TypeError('starts');
  const config=organizationConfig(org,options.env??process.env),scope={organizationId:config.id,seasonId:context.season.seasonId,groupId:group.id,phaseId:phase.id};
  const key=[config.code,scope.seasonId,group.id,phase.id,minStarts].join(':'),useCache=!options.loadTables&&!options.loadGames;
  if(useCache&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  if(useCache&&pending.has(key))return pending.get(key);
  if(pending.size>=12)throw new Error('Busy');
  const task=(async()=>{
    const [tables,history]=await Promise.all([(options.loadTables??readComparisonTables)(scope,options),(options.loadGames??loadComparisonGames)(config,scope,options).catch(()=>null)]);
    const comparison=compareTeams(tables,history??[],scope,{minStarts});
    let meetings=null;try{meetings=comparisonMeetings(await(options.loadMeetings??loadComparisonMeetings)(config,scope,comparison.teams,options),scope,comparison.teams);}catch{}
    const value={...context,group,phase,...comparison,meetings,historyAvailable:history!==null,readAt:new Date().toISOString(),source:'HMS public statistics / shared imported results'};
    if(useCache){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+60000});}return value;
  })();
  if(useCache){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
