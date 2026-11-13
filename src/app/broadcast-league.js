import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {broadcastScope} from './broadcast-context.js';
import {officialPlayers} from '../../public/widgets/statistics.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const label=v=>typeof v==='string'?v.trim().slice(0,200):null;
const count=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const points=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=1000000?Number(v):null;
export function officialStandings(rows){
  if(!Array.isArray(rows)||rows.length>2000)throw new Error('Invalid standings');
  const seen=new Set();
  // The official public table renders rows in API order. Rank the complete table
  // before selecting the two match teams; never renumber a filtered excerpt.
  return rows.map((r,index)=>{
    const id=isGameId(r.TeamId)?r.TeamId.toLowerCase():null,name=label(r['Team Name']),games=count(r['Total Games']),totalPoints=points(r['Total Points']);
    if(!id||seen.has(id)||!name||games===null||totalPoints===null)throw new Error('Invalid standings row');seen.add(id);
    return {id,name,shortName:label(r['Team Name Short']),logoUrl:sportingImage(r.TeamLogo),rank:index+1,games,points:totalPoints,
      wins:count(r.Wins),draws:count(r.Draws),losses:count(r.Losses),score:typeof r.Score==='string'&&/^\d{1,4}:\d{1,4}$/.test(r.Score)?r.Score:null};
  });
}
export function officialTeamLeaders(rows,detail){
  const teams={home:[],away:[]};
  for(const p of officialPlayers(rows)){
    const side=same(p.teamId,detail.homeTeamId??detail.HomeTeam?.teamId)?'home':same(p.teamId,detail.awayTeamId??detail.AwayTeam?.teamId)?'away':null;
    if(!side||![p.goals,p.assists,p.games].every(Number.isSafeInteger))continue;
    const {id,name,goals,assists,points,games,number,imageUrl}=p;
    teams[side].push({id,name,goals,assists,points,games,number,imageUrl});
  }
  return teams;
}
async function readTable(endpoint,params,options){
  const url=new URL('https://api.prod.hms.wootera.net/public/'+endpoint);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  const response=await(options.fetchImpl??fetch)(url,{...(options.freshPortraits?{cache:'no-store'}:{}),headers:{accept:'application/json',...(options.freshPortraits?{'cache-control':'no-cache'}:{})},signal:AbortSignal.timeout(5000)});
  if(!response.ok||Number(response.headers?.get('content-length'))>4000000)throw new Error('Public statistics unavailable');
  if(!response.body?.getReader)return response.json();
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000)throw new Error('Large statistics');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
const statisticsCache=new Map(),statisticsPending=new Map(),testCaches=new WeakMap();
// One bounded official table per scope/role. All metrics and instances reuse it.
export async function readOfficialStatistics(scope,role,options={}){
  const params=scope.phaseId?{[role==='goalie'?'phaseId':'phaseIds']:scope.phaseId}:scope.groupId?{groupId:scope.groupId}:scope.seasonId?{seasonId:scope.seasonId}:null;
  if(!params||!Object.values(params).every(isGameId)||!['skater','goalie'].includes(role))throw new TypeError('statistics scope');
  let cache=statisticsCache,pending=statisticsPending;
  if(options.fetchImpl){if(!testCaches.has(options.fetchImpl))testCaches.set(options.fetchImpl,{cache:new Map(),pending:new Map()});({cache,pending}=testCaches.get(options.fetchImpl));}
  const key=role+':'+JSON.stringify(params).toLowerCase();
  if(cache.get(key)?.until>Date.now())return cache.get(key).rows;
  if(pending.has(key))return pending.get(key);if(pending.size>=16)throw new Error('Statistics busy');
  const task=(async()=>{const rows=await readTable(role==='goalie'?'goaliesStats':'playersStats',params,options);if(!Array.isArray(rows)||rows.length>20000)throw new Error('Invalid statistics');if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{rows,until:Date.now()+60000});return rows;})();
  pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
// Current public portraits only. Callers retain their own historical statistics.
export async function readPlayerPortraits(groupId,options={}){
  if(!isGameId(groupId))throw new TypeError('group');
  const results=await Promise.allSettled(['playersStats','goaliesStats'].map(endpoint=>readTable(endpoint,{groupId},{...options,freshPortraits:true})));
  return Object.fromEntries(['players','goalies'].map((key,i)=>[key,results[i].status==='fulfilled'?results[i].value:null]));
}
// Bounded, fixed-host transport shared by comparison and broadcast statistics.
export async function readComparisonTables(scope,options={}){
  if(!isGameId(scope?.phaseId))throw new TypeError('phase');
  const results=await Promise.allSettled([
    readTable('standings',{phaseId:scope.phaseId},options),
    readOfficialStatistics(scope,'skater',options),
    readOfficialStatistics(scope,'goalie',options),
  ]);
  return Object.fromEntries(['standings','players','goalies'].map((key,i)=>[key,results[i].status==='fulfilled'?results[i].value:null]));
}
export async function readOfficialStandings(scope,options={}){
  const query=scope?.phaseId?{phaseId:scope.phaseId}:scope?.groupId?{groupId:scope.groupId}:null;
  if(!query)throw new Error('Missing phase/group');
  return officialStandings(await readTable('standings',query,options));
}
const cache=new Map(),pending=new Map();
export async function broadcastLeague(detail,options={}){
  const scope=broadcastScope(detail),key=[scope.organizationId,scope.groupId,scope.phaseId,detail.gameId].join(':'),cacheable=!options.fetchImpl;
  if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  if(cacheable&&pending.has(key))return pending.get(key);
  if(pending.size>=8)throw new Error('Statistics busy');
  const task=(async()=>{
    const value={scope,source:'HMS',readAt:new Date().toISOString(),standingsAvailable:false,leadersAvailable:false,standings:[],leaders:{home:[],away:[]},statsScope:scope.groupId?'group':'phase'};
    const leaderQuery=scope.groupId?{groupId:scope.groupId}:scope.phaseId?{phaseIds:scope.phaseId}:null;
    const [standings,leaders]=await Promise.allSettled([readOfficialStandings(scope,options),leaderQuery?readOfficialStatistics(scope.groupId?{groupId:scope.groupId}:scope,'skater',options):Promise.reject(new Error('Missing group/phase'))]);
    if(standings.status==='fulfilled'){value.standings=standings.value;value.standingsAvailable=true;}
    if(leaders.status==='fulfilled')try{value.leaders=officialTeamLeaders(leaders.value,detail);value.leadersAvailable=true;}catch{}
    if(cacheable){if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+60000});}return value;
  })();
  if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
