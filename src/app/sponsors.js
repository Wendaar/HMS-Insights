import {sponsorLogo} from '../../public/sponsors/model.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {fetchSponsors,fetchTeams,fetchOrganization,hmsConfigFromEnv} from '../hms/client.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const text=(v,n=240)=>typeof v==='string'?v.trim().slice(0,n)||null:null;
const uuid=v=>isGameId(v)?v.toLowerCase():null;
const image=v=>sportingImage(v?.logoUrls?.md??v?.logoUrl??v?.imageUrls?.md);
function rows(raw){if(!Array.isArray(raw)||raw.length>10000)throw new Error('Unexpected HMS catalog shape');return raw.filter(v=>v&&typeof v==='object'&&!v.isDeleted);}
function link(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.href.length<=1000?u.href:null;}catch{return null;}}
export function sponsorCatalog(sponsorResponse,teamResponse,org){
  const sponsors=rows(sponsorResponse),teams=teamResponse===null?null:rows(teamResponse);
  for(const row of [...sponsors,...(teams??[])])if(row.organizationId&&!same(row.organizationId,org.id))throw new Error('Catalog organization mismatch');
  const items=sponsors.filter(s=>s.active!==false&&s.isActive!==false&&!['INACTIVE','DISABLED','DELETED','ARCHIVED'].includes(String(s.status??'').toUpperCase())).map(s=>{const id=uuid(s.sponsorId),logo=sponsorLogo(s);if(!id||!text(s.name))throw new Error('Missing sponsor identity');return {id,name:text(s.name),nick:text(s.nick),short:text(s.short),claim:text(s.claim,500),web:link(s.web),website:link(s.web??s.website),description:text(s.description,1200),logo,logoUrl:logo.displayUrl,active:true,activeSource:typeof s.active==='boolean'||typeof s.isActive==='boolean'||s.status?'HMS':'not-disabled',teams:(s.teamIds??[]).filter(isGameId).map(uuid),competitions:(s.competitionIds??[]).filter(isGameId).map(uuid),
    scopeRefs:Object.fromEntries(['teamIds','competitionIds','seasonIds','groupIds','phaseIds','venueIds'].filter(k=>Array.isArray(s[k])).map(k=>[k,[...new Set(s[k].map(uuid).filter(Boolean))]]))};});
  const teamItems=(teams??[]).map(t=>{const id=uuid(t.teamId);if(!id||!text(t.name))throw new Error('Missing team identity');return {id,name:text(t.name),logoUrl:image(t)};});
  const sponsorIds=new Set(items.map(s=>s.id)),teamIds=new Set(teamItems.map(t=>t.id)),bindings=new Map();
  const bind=(sponsorId,teamId)=>{const s=uuid(sponsorId),t=uuid(teamId);if(sponsorIds.has(s)&&teamIds.has(t))bindings.set(s+':'+t,{sponsorId:s,teamId:t,source:'HMS'});};
  const fields=(row,names)=>names.flatMap(k=>Array.isArray(row[k])?row[k]:[]).filter(v=>!v?.isDeleted);
  for(const t of teams??[])for(const s of fields(t,['Sponsors','sponsors','TeamSponsors','sponsorIds']))bind(typeof s==='string'?s:s.sponsorId??s.Sponsor?.sponsorId,t.teamId);
  for(const s of sponsors)for(const t of fields(s,['Teams','teams','TeamSponsors','teamIds']))bind(s.sponsorId,typeof t==='string'?t:t.teamId??t.Team?.teamId);
  const observed=values=>[...new Set(values.flatMap(v=>Object.keys(v)))].sort();
  return {schemaVersion:2,org:org.code,source:'HMS API',readAt:new Date().toISOString(),items,teams:teamItems,bindings:[...bindings.values()],
    teamsAvailable:teams!==null,relationshipStatus:bindings.size?'returned-links':teams===null?'teams-unavailable':'no-links-returned',
    // Field names only: enough to verify API capabilities without exposing raw records/contact fields.
    fields:{sponsors:observed(sponsors),teams:observed(teams??[])}};
}
const cache=new Map(),pending=new Map();
export async function loadSponsorCatalog(org,options={}){
  const key=org.code+':'+org.id.toLowerCase(),cacheable=!options.fetchSponsors;
  if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
  if(cacheable&&pending.has(key))return pending.get(key);
  if(pending.size>=8)throw new Error('Catalog busy');
  const task=(async()=>{
    const config={...hmsConfigFromEnv({...options.env,HMS_API_TOKEN:org.token}),timeoutMs:5000,retries:0};
    const [organization,sponsors,teams]=await Promise.allSettled([(options.fetchOrganization??fetchOrganization)({config}),(options.fetchSponsors??fetchSponsors)({config}),(options.fetchTeams??fetchTeams)({config})]);
    if(organization.status==='rejected')throw organization.reason;
    if(!same(organization.value?.organizationId,org.id))throw new Error('API token organization mismatch');
    if(sponsors.status==='rejected')throw sponsors.reason;
    const result=sponsorCatalog(sponsors.value,teams.status==='fulfilled'?teams.value:null,org);
    if(cacheable){if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{value:result,until:Date.now()+60000});}return result;
  })();
  if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
