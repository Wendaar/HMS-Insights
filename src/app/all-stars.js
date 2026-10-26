import {isGameId,buildGameSummary} from '../domain/game-summary.js';
import {calendarDate,publicSeasonGame} from '../domain/season-games.js';
import {organizationConfig} from './organizations.js';
import {controlContextCatalog} from './control-context.js';
import {loadAllStarsGames} from '../infrastructure/postgres-repository.js';
import {readPublicGameDay} from './season-games.js';
export const limits={F:3,D:2,G:1};
const lower=v=>String(v??'').toLowerCase();
export function allStarsScope(input){
  if(!input||!isGameId(input.seasonId)||!/^20\d\d-(0[1-9]|1[0-2])$/.test(input.month??'')||!calendarDate(input.month+'-01'))throw new TypeError('scope');
  if(input.groupId&&!isGameId(input.groupId))throw new TypeError('scope');
  return {seasonId:lower(input.seasonId),month:input.month,groupId:lower(input.groupId)};
}
export function allStarsSettings(input){
  const scope=allStarsScope(input);
  if(!isGameId(scope.groupId))throw new TypeError('group');
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>100||/[<>\x00-\x1f]/.test(input.title))throw new TypeError('title');
  const selection={};const seen=new Set();
  for(const role of Object.keys(limits)){
    const ids=input.selection?.[role]??[];
    if(!Array.isArray(ids)||ids.length>limits[role])throw new TypeError('selection');
    selection[role]=ids.map(id=>{
      if(typeof id!=='string'||!/^([\da-f-]{36})\|([\da-f-]{36})$/.test(id)||!id.split('|').every(isGameId)||seen.has(id))throw new TypeError('selection');
      seen.add(id);return id;
    });
  }
  return {...scope,title:input.title.trim(),selection,rules:'calendar-manual-v1'};
}
// Only recorded sporting facts enter this read model. Never sum different teams.
export function nominateAllStars(snapshots,fixtures,scope){
  const expected=fixtures.filter(g=>g.status==='FINISHED'&&(!scope.groupId||g.group.id===scope.groupId));
  const byId=new Map(snapshots.map(s=>[lower(s.game.game_id),s]));
  const selected=expected.map(g=>byId.get(g.id)).filter(Boolean);
  const groups=[...new Map(fixtures.filter(g=>g.group.id).map(g=>[g.group.id,g.group])).values()];
  const teamGames=new Map(),players=new Map();let unsuitable=0,verifiedByTotals=0;
  for(const game of expected)for(const team of [game.home,game.away])teamGames.set(team.id,(teamGames.get(team.id)??0)+1);
  for(const snapshot of selected){
    const summary=buildGameSummary(snapshot),game=snapshot.game;
    const fixture=expected.find(g=>g.id===lower(game.game_id));
    const totalsMatch=[summary.home,summary.away].every(team=>{
      const rows=summary.players.filter(p=>lower(p.teamId)===lower(team.id));
      return rows.length>0&&rows.every(p=>Number.isInteger(p.goals)&&p.goals>=0&&Number.isInteger(p.assists)&&p.assists>=0&&Number.isFinite(p.penaltyMinutes)&&p.penaltyMinutes>=0)&&rows.reduce((sum,p)=>sum+p.goals,0)===team.score;
    });
    // Historical imports predate event snapshots but retain real per-game stats.
    // Validate their player totals against both current official team scores.
    // A present contradictory timeline never gets this legacy compatibility path.
    const legacy=!game.event_snapshot&&totalsMatch;
    if((summary.provenance.eventCoverage!=='matches-result'&&!legacy)||!totalsMatch||summary.home.score!==fixture.home.score||summary.away.score!==fixture.away.score||lower(summary.home.id)!==fixture.home.id||lower(summary.away.id)!==fixture.away.id||lower(game.group_id)!==fixture.group.id){unsuitable++;continue;}
    if(legacy)verifiedByTotals++;
    for(const [role,rows] of [['S',summary.players],['G',summary.goalies]])for(const row of rows){
      const team=[summary.home,summary.away].find(t=>lower(t.id)===lower(row.teamId));
      if(!team||!isGameId(row.id))continue;
      const id=lower(row.id)+'|'+lower(team.id),key=id+'|'+role,old=players.get(key);
      const p=old??{id,playerId:lower(row.id),teamId:lower(team.id),name:row.name,team:team.name,imageUrl:row.imageUrl,kind:role,gp:0,goals:0,assists:0,pim:0,saves:0,ga:0,statsKnown:true,positions:new Set()};
      p.gp++;
      if(role==='S'){
        p.goals+=row.goals;p.assists+=row.assists;p.pim+=row.penaltyMinutes;
        const roster=game.event_snapshot?.roster?.find(r=>lower(r.id)===lower(row.id)&&lower(r.teamId)===lower(team.id));
        if(['F','D'].includes(roster?.position))p.positions.add(roster.position);
      }else{
        const conceded=lower(team.id)===lower(summary.home.id)?summary.away.score:summary.home.score;
        const currentTeam=lower(team.id)===fixture.home.id?fixture.home:fixture.away;
        const teamGoalies=summary.goalies.filter(k=>lower(k.teamId)===lower(team.id));
        if(row.savePercentage===null||row.saves===null||row.goalsAgainst===null||teamGoalies.reduce((sum,k)=>sum+(k.goalsAgainst??0),0)!==conceded||legacy&&(currentTeam.saves==null||teamGoalies.reduce((sum,k)=>sum+(k.saves??0),0)!==currentTeam.saves))p.statsKnown=false;
        p.saves+=row.saves??0;p.ga+=row.goalsAgainst??0;
      }
      players.set(key,p);
    }
  }
  const result={F:[],D:[],G:[]};
  for(const p of players.values()){
    p.coverage=p.gp/(teamGames.get(p.teamId)||Infinity);p.eligible=p.coverage>.5;p.points=p.goals+p.assists;
    p.sv=p.statsKnown&&p.saves+p.ga>0?p.saves/(p.saves+p.ga):null;
    p.positionUnverified=p.kind==='S'&&!p.positions.size;
    // Official stars and goalie shutouts are absent from the shared snapshots.
    // Do not turn missing metrics into zero: expose a separate provisional score.
    p.score=p.kind==='S'?6*p.points/p.gp+3*p.coverage-.03*p.pim:p.sv===null?null:100*p.sv+8*p.coverage-2*p.ga/p.gp;
    const roles=p.kind==='G'?['G']:p.positions.size?[...p.positions]:['F','D'];
    const {positions,kind,statsKnown,...candidate}=p;
    for(const role of roles)result[role].push({...candidate,role});
  }
  for(const list of Object.values(result))list.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.score??-Infinity)-(a.score??-Infinity)||a.name.localeCompare(b.name));
  const missing=expected.filter(g=>!byId.has(g.id)).map(g=>({id:g.id,label:`${g.home.name} — ${g.away.name} · ${g.date}`}));
  return {candidates:result,groups,coverage:{expected:expected.length,imported:selected.length,usable:selected.length-unsuitable,verifiedByTotals,missing,unsuitable,complete:expected.length>0&&!missing.length&&!unsuitable},source:'HMS API / shared imported game snapshots',rules:'calendar-manual-v1'};
}
export function resolvedSelection(config,data,{complete=false}={}){
  const result={};
  for(const [role,count] of Object.entries(limits)){
    const ids=config.selection[role];if(complete&&ids.length!==count)throw new TypeError('six');
    result[role]=ids.map(id=>{const player=data.candidates[role].find(p=>p.id===id);if(!player)throw new TypeError('candidate');return player;});
  }
  return result;
}
export async function readAllStars(org,input,options={}){
  const scope=allStarsScope(input),config=organizationConfig(org,options.env??process.env);
  const catalog=await controlContextCatalog(org,options);
  const season=catalog.items.find(s=>s.seasonId===scope.seasonId);if(!season)throw new TypeError('season');
  const from=scope.month+'-01',end=new Date(from+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
  const to=end.toISOString().slice(0,10),dates=Array.from({length:end.getUTCDate()},(_,i)=>scope.month+'-'+String(i+1).padStart(2,'0'));
  const snapshots=await(options.loadAllStarsGames??loadAllStarsGames)(config.id,scope.seasonId,from,to,options);
  if(snapshots.length>500)throw new Error('Too many games');
  for(const s of snapshots)if(lower(s.game.organization_id)!==lower(config.id)||lower(s.game.season_id)!==scope.seasonId||String(s.game.played_on instanceof Date?s.game.played_on.toISOString():s.game.played_on).slice(0,7)!==scope.month)throw new Error('Snapshot context mismatch');
  let cursor=0;const fixtures=[];
  await Promise.all(Array.from({length:3},async()=>{while(cursor<dates.length){const day=dates[cursor++];const raw=await(options.readDay??readPublicGameDay)(scope.seasonId,day,options);fixtures.push(...raw.map(g=>{
    const fixture=publicSeasonGame(g,scope.seasonId,day),count=v=>v!==null&&v!==undefined&&v!==''&&Number.isInteger(Number(v))&&Number(v)>=0?Number(v):null;
    fixture.home.saves=count(g.HomeTeamSaves);fixture.away.saves=count(g.AwayTeamSaves);return fixture;
  }));}}));
  const seen=new Set();for(const g of fixtures){if(seen.has(g.id))throw new Error('Duplicate game');seen.add(g.id);}
  if(scope.groupId&&!fixtures.some(g=>g.group.id===scope.groupId))throw new TypeError('group');
  const data=nominateAllStars(snapshots,fixtures,scope);
  return {...data,org:config.code,scope,season,readAt:new Date().toISOString(),monthClosed:scope.month<new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit'}).format(options.now??new Date()).slice(0,7)};
}
