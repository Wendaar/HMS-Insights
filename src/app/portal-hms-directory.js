import {loadPortalHmsSeason} from './portal-hms-catalog.js';
import {readDirectoryTeams} from './broadcast-league.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';

const cache=new Map(),pending=new Map();
export async function loadPortalHmsDirectory(org,seasonId,options={}){
 if(!isGameId(seasonId))throw new TypeError('directory season');
 const key=[org.code,org.id.toLowerCase(),seasonId.toLowerCase()].join(':');
 const cacheable=!options.sql&&!Object.values(options).some(v=>typeof v==='function');
 const cached=cache.get(key);
 if(cacheable&&cached?.token===org.token&&cached.until>Date.now())return cached.value;
 if(cacheable&&pending.get(key)?.token===org.token)return pending.get(key).task;
 if(pending.size>=16)throw new Error('HMS directory busy');
 const task=(async()=>{
  const season=await loadPortalHmsSeason(org,seasonId,options);if(!season)return null;
  const groups=structuredClone(season.groups),teams=new Map();
  const jobs=[{scope:{seasonId:season.seasonId}}];
  for(const group of groups){
   group.teamIds=[];
   jobs.push({scope:{groupId:group.id},group});
   for(const phase of group.phases){phase.teamIds=[];jobs.push({scope:{phaseId:phase.id},group,phase});}
  }
  // Bound a cold request even for unusually large competition hierarchies.
  const budget=32;let next=0,failed=0;
  for(const job of jobs.slice(budget)){job.rows=null;failed++;}
  // At most four fixed-host reads at a time, shared by all directory consumers.
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{
   while(next<Math.min(budget,jobs.length)){
    const job=jobs[next++];
    try{job.rows=await(options.readDirectoryTeams??readDirectoryTeams)(job.scope,options);}
    catch{job.rows=null;failed++;}
   }
  }));
  for(const job of jobs){
   if(job.group&&!job.phase)job.group.teamsAvailable=job.rows!==null;
   if(job.phase)job.phase.teamsAvailable=job.rows!==null;
   if(job.rows===null)continue;
   if(!Array.isArray(job.rows)||job.rows.length>2000)throw new Error('HMS membership size');
   const seen=new Set();
   for(const row of job.rows){
    if(!isGameId(row.id)||typeof row.name!=='string'||!row.name.trim()||seen.has(row.id.toLowerCase()))throw new Error('HMS membership identity');
    const id=row.id.toLowerCase();seen.add(id);
    if(!teams.has(id)&&teams.size>=2000)throw new Error('HMS directory team limit');
    const team=teams.get(id)??{id,name:row.name.trim().slice(0,200),logoUrl:sportingImage(row.logoUrl),groupIds:[],phaseIds:[]};
    if(job.group){
     if(!team.groupIds.includes(job.group.id))team.groupIds.push(job.group.id);
     if(!job.group.teamIds.includes(id))job.group.teamIds.push(id);
    }
    if(job.phase){team.phaseIds.push(job.phase.id);job.phase.teamIds.push(id);}
    teams.set(id,team);
   }
  }
  for(const group of groups)group.teamCount=group.teamsAvailable?group.teamIds.length:null;
  const value={groups,teams:[...teams.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs')),teamCount:failed?null:teams.size,membershipComplete:failed===0,source:failed?'hms-live-partial':'hms-live'};
  if(cacheable){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{token:org.token,value,until:Date.now()+60000});}
  return value;
 })();
 if(cacheable){pending.set(key,{token:org.token,task});task.finally(()=>{if(pending.get(key)?.task===task)pending.delete(key);}).catch(()=>{});}
 return task;
}
