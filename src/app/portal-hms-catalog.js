import {fetchOrganization,fetchCompetitions,hmsConfigFromEnv} from '../hms/client.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';

const cache=new Map(),pending=new Map();
const id=v=>isGameId(v)?v.toLowerCase():null;
const name=v=>typeof v==='string'?v.trim().slice(0,160):'';
const image=v=>sportingImage(v?.logoUrls?.md)??sportingImage(v?.logoUrl);

// The integration token scopes this endpoint. Check its identity independently
// before trusting any hierarchy; never infer ownership from public embed metadata.
export async function loadPortalHmsCatalog(org,options={}){
 if(!org.token&&!options.fetchCompetitions)return null;
 const cacheable=!options.fetchOrganization&&!options.fetchCompetitions;
 const key=org.code+':'+org.id.toLowerCase();
 const cached=cache.get(key);
 if(cacheable&&cached?.token===org.token&&cached.until>Date.now())return cached.value;
 if(cacheable&&pending.get(key)?.token===org.token)return pending.get(key).task;
 if(pending.size>=12)throw new Error('HMS catalog busy');
 const task=(async()=>{
  const config={...hmsConfigFromEnv({...options.env,HMS_API_TOKEN:org.token??'injected-test'}),timeoutMs:5000,retries:0};
  let organization,response;
  try{
   [organization,response]=await Promise.all([
    (options.fetchOrganization??fetchOrganization)({config}),
    (options.fetchCompetitions??fetchCompetitions)({config}),
   ]);
  }catch{return null;}
  if(id(organization?.organizationId)!==id(org.id))throw new Error('HMS catalog organization mismatch');
  const competitions=Array.isArray(response)?response:response?.Competitions;
  if(!Array.isArray(competitions)||competitions.length>500)throw new Error('HMS competitions shape');
  const items=new Map();
  for(const competition of competitions){
   if(competition.isDeleted)continue;
   if(competition.organizationId&&id(competition.organizationId)!==id(org.id))throw new Error('HMS competition ownership');
   if(!id(competition.competitionId)||!name(competition.name)||!Array.isArray(competition.Seasons))throw new Error('HMS competition shape');
   if(competition.Seasons.length>500)throw new Error('HMS seasons size');
   for(const season of competition.Seasons){
    if(season.isDeleted)continue;
    if(season.organizationId&&id(season.organizationId)!==id(org.id)||season.competitionId&&id(season.competitionId)!==id(competition.competitionId))throw new Error('HMS season ownership');
    if(!id(season.seasonId)||!name(season.name))throw new Error('HMS season shape');
    const seasonId=id(season.seasonId),competitionId=id(competition.competitionId);
    if(items.has(seasonId)||items.size>=300)throw new Error('HMS ambiguous or oversized seasons');
    items.set(seasonId,{seasonId,competitionId,competition:name(competition.name),season:name(season.name),name:name(competition.name)+' · '+name(season.name),sampleGameId:null,competitionLogoUrl:image(competition),seasonLogoUrl:image(season),organizationLogoUrl:image(organization)});
   }
  }
  const value=[...items.values()];
  if(cacheable){if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{token:org.token,value,until:Date.now()+60000});}
  return value;
 })();
 if(cacheable){pending.set(key,{token:org.token,task});task.finally(()=>{if(pending.get(key)?.task===task)pending.delete(key);}).catch(()=>{});}
 return task;
}
