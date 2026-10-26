import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {broadcastScope} from './broadcast-context.js';
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
  if(!Array.isArray(rows)||rows.length>20000)throw new Error('Invalid player statistics');
  const teams={home:[],away:[]},seen=new Map();
  for(const row of rows){
    const side=same(row.TeamId,detail.homeTeamId??detail.HomeTeam?.teamId)?'home':same(row.TeamId,detail.awayTeamId??detail.AwayTeam?.teamId)?'away':null;
    if(!side||!isGameId(row.PlayerId))continue;
    const name=label([row.FirstName,row.LastName].filter(v=>typeof v==='string').join(' ')),goals=count(row.G),assists=count(row.A),games=count(row.GP);
    if(!name||goals===null||assists===null||games===null)continue;
    const player={id:row.PlayerId.toLowerCase(),name,goals,assists,points:count(row.P)??goals+assists,games,number:count(row.JerseyNumber),imageUrl:sportingImage(row.PlayerLogo)};
    const key=side+':'+player.id;if(seen.has(key)){if(JSON.stringify(seen.get(key))!==JSON.stringify(player))throw new Error('Ambiguous player statistics');continue;}
    seen.set(key,player);teams[side].push(player);
  }
  return teams;
}
async function readTable(endpoint,params,options){
  const url=new URL('https://api.prod.hms.wootera.net/public/'+endpoint);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  const response=await(options.fetchImpl??fetch)(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok||Number(response.headers?.get('content-length'))>4000000)throw new Error('Public statistics unavailable');
  if(!response.body?.getReader)return response.json();
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000)throw new Error('Large statistics');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
const cache=new Map(),pending=new Map();
export async function broadcastLeague(detail,options={}){
  const scope=broadcastScope(detail),key=[scope.organizationId,scope.groupId,scope.phaseId,detail.gameId].join(':'),cacheable=!options.fetchImpl;
  if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  if(cacheable&&pending.has(key))return pending.get(key);
  if(pending.size>=8)throw new Error('Statistics busy');
  const task=(async()=>{
    const value={scope,source:'HMS',readAt:new Date().toISOString(),standingsAvailable:false,leadersAvailable:false,standings:[],leaders:{home:[],away:[]},statsScope:scope.groupId?'group':'phase'};
    const standingQuery=scope.phaseId?{phaseId:scope.phaseId}:scope.groupId?{groupId:scope.groupId}:null;
    const leaderQuery=scope.groupId?{groupId:scope.groupId}:scope.phaseId?{phaseIds:scope.phaseId}:null;
    const [standings,leaders]=await Promise.allSettled([standingQuery?readTable('standings',standingQuery,options):Promise.reject(new Error('Missing phase/group')),leaderQuery?readTable('playersStats',leaderQuery,options):Promise.reject(new Error('Missing group/phase'))]);
    if(standings.status==='fulfilled')try{value.standings=officialStandings(standings.value);value.standingsAvailable=true;}catch{}
    if(leaders.status==='fulfilled')try{value.leaders=officialTeamLeaders(leaders.value,detail);value.leadersAvailable=true;}catch{}
    if(cacheable){if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+60000});}return value;
  })();
  if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
