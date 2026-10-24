import {seasonGamesQuery,publicSeasonGame,seasonGamePage} from '../domain/season-games.js';
import {loadAvailableGameReports} from '../infrastructure/postgres-repository.js';
const days=new Map(),pending=new Map(),meta=new Map();
let cooldownUntil=0;
const MAX_BYTES=4*1024*1024;
export class ScheduleSourceError extends Error{constructor(status=503,retryAfter=30){super('Schedule source unavailable');this.status=status;this.retryAfter=Math.min(300,Math.max(1,Number(retryAfter)||30));}}
async function publicRead(endpoint,params,options){
  if(!options.fetchImpl&&cooldownUntil>Date.now())throw new ScheduleSourceError(429,Math.ceil((cooldownUntil-Date.now())/1000));
  const url=new URL('https://api.prod.hms.wootera.net/public/'+endpoint);for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const response=await(options.fetchImpl??fetch)(url.href,{headers:{accept:'application/json'},signal:AbortSignal.timeout(6000)});
  if(!response.ok){const error=new ScheduleSourceError(response.status===429?429:503,response.headers?.get('retry-after'));if(error.status===429&&!options.fetchImpl)cooldownUntil=Date.now()+error.retryAfter*1000;throw error;}
  if(Number(response.headers?.get('content-length'))>MAX_BYTES)throw new ScheduleSourceError();
  if(!response.body?.getReader)return response.json(); // injected test response
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new ScheduleSourceError();chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function readDay(seasonId,date,options){
  const key=seasonId+':'+date,cacheable=!options.fetchImpl;
  if(cacheable&&days.get(key)?.until>Date.now())return days.get(key).value;
  if(cacheable&&pending.has(key))return pending.get(key);
  if(cacheable&&pending.size>=24)throw new ScheduleSourceError();
  const task=(async()=>{
    const raw=await publicRead('games',{seasonId,startDate:date},options);
    if(!Array.isArray(raw)||raw.length>2000)throw new ScheduleSourceError();
    const value=raw.filter(g=>!g.isDeleted).map(g=>publicSeasonGame(g,seasonId,date));
    if(cacheable){while(days.size&&(days.size>=80||[...days.values()].reduce((n,day)=>n+day.value.length,0)+value.length>10000))days.delete(days.keys().next().value);days.set(key,{value,until:Date.now()+60000});}return value;
  })();
  if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
async function seasonLabels(seasonId,options){
  if(!options.fetchImpl&&meta.get(seasonId)?.until>Date.now())return meta.get(seasonId).value;
  try{
    const value=await publicRead('seasonTerms',{seasonId},options);
    if(value?.seasonId&&String(value.seasonId).toLowerCase()!==seasonId)return {};
    const label=v=>typeof v==='string'?v.trim().slice(0,160):null;
    const result={season:label(value?.name),competition:label(value?.Competition?.name)};
    if(!options.fetchImpl){if(meta.size>=80)meta.delete(meta.keys().next().value);meta.set(seasonId,{value:result,until:Date.now()+300000});}return result;
  }catch{return {};}
}
export async function browseSeasonGames(query,options={}){
  const request=seasonGamesQuery(query,options.now),result=new Array(request.dates.length);let cursor=0;
  const labelsPromise=seasonLabels(request.seasonId,options);
  await Promise.all(Array.from({length:Math.min(3,request.dates.length)},async()=>{while(cursor<request.dates.length){const index=cursor++;result[index]=await readDay(request.seasonId,request.dates[index],options);}}));
  const page=seasonGamePage(result.flat(),request),labels=await labelsPromise;
  let availabilityKnown=false;
  if(page.items.length&&((options.env??process.env).DATABASE_URL||options.loadReports))try{
    const ids=await(options.loadReports??loadAvailableGameReports)(page.items.map(g=>g.id),request.seasonId,{env:options.env});
    const available=new Set(ids.map(id=>String(id).toLowerCase()));page.items=page.items.map(g=>({...g,reportAvailable:available.has(g.id)}));availabilityKnown=true;
  }catch{/* Schedule remains usable when imported-report storage is unavailable. */}
  return {...page,seasonId:request.seasonId,competition:result.flat()[0]?.competition??labels.competition??null,season:result.flat()[0]?.season??labels.season??null,filter:request.filter,windowPage:request.windowPage,from:request.from,to:request.to,availabilityKnown,source:'HMS',readAt:new Date().toISOString()};
}
