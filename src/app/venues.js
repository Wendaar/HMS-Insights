import {fetchOrganization,fetchVenues,hmsConfigFromEnv} from '../hms/client.js';
import {isGameId} from '../domain/game-summary.js';
import {hmsMediaContext} from '../hms/media-context.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const label=v=>typeof v==='string'?v.trim().slice(0,160):null;
const backgroundFields=['igBgImageUrl','backgroundImageUrl','backgroundImageUrlForInfographics','infographicsBackgroundImageUrl'];
export function venueCatalog(rows,org,{ids=[]}={}){
 if(!Array.isArray(rows)||rows.length>500)throw new Error('Invalid venue catalog');
 const seen=new Set(),allowed=new Set(ids.map(id=>id.toLowerCase()));
 const items=[];
 for(const row of rows){
  if(!row||typeof row!=='object'||!isGameId(row.venueId)||row.organizationId&&!same(row.organizationId,org.id))throw new Error('Invalid or foreign venue');
  const id=row.venueId.toLowerCase();if(seen.has(id)||allowed.size&&!allowed.has(id))throw new Error('Unexpected venue identity');seen.add(id);
  if(row.isDeleted)continue;
  if(!label(row.name))throw new Error('Missing venue name');
  const media=hmsMediaContext({Venue:row}),backgroundField=backgroundFields.find(key=>Object.hasOwn(row,key))??Object.keys(row).find(key=>/background|infographic/i.test(key))??null;
  const hasLogoField=['logoUrls','logoUrl','imageUrls','avatarUrl'].some(key=>Object.hasOwn(row,key));
  items.push({id,name:label(row.name),nick:label(row.nick),short:label(row.short),logoUrl:media.venueLogoUrl,backgroundSourceUrl:media.venueBackgroundUrl,
   availability:{logo:media.venueLogoUrl?'available':hasLogoField?'empty':'not-exposed',background:media.venueBackgroundUrl?'available':backgroundField?(row[backgroundField]?'unsupported':'empty'):'not-exposed'},
   backgroundField,fields:Object.keys(row).sort()});
 }
 return {org:org.code,source:'HMS /venues',readAt:new Date().toISOString(),items};
}
const cache=new Map(),pending=new Map();
export async function loadVenueCatalog(org,options={}){
 const ids=options.ids??[];
 if(!Array.isArray(ids)||ids.length>500||!ids.every(isGameId))throw new TypeError('Invalid venue IDs');
 if(!org.token)throw new Error('Venue connection unavailable');
 const selected=[...new Set(ids.map(id=>id.toLowerCase()))].sort(),key=[org.code,org.id.toLowerCase(),...selected].join(':'),cacheable=!options.fetchVenues&&!options.fetchOrganization;
 if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
 if(cacheable&&pending.has(key))return pending.get(key);if(pending.size>=8)throw new Error('Venue catalog busy');
 const task=(async()=>{
  const config={...hmsConfigFromEnv({...(options.env??process.env),HMS_API_TOKEN:org.token}),timeoutMs:4000,retries:0};
  const organization=await(options.fetchOrganization??fetchOrganization)({config});
  if(!same(organization?.organizationId,org.id))throw new Error('Venue token organization mismatch');
  const rows=await(options.fetchVenues??fetchVenues)(selected.length?{ids:selected.join(',')}:{},{config});
  const value=venueCatalog(rows,org,{ids:selected});
  if(cacheable){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+60000});}return value;
 })();
 if(cacheable){pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});}return task;
}
export function applyVenueCatalog(summary,catalog){
 if(!isGameId(summary.venueId)||catalog.org!==summary.org)return summary;
 const venue=catalog.items.find(v=>same(v.id,summary.venueId));if(!venue)return summary;
 // ID is the join key. A similarly named venue never supplies another rink's media.
 summary.venueLogoUrl ||=venue.logoUrl;
 summary.venueBackgroundUrl ||=venue.backgroundSourceUrl;
 summary.venueMedia={source:'HMS /venues',availability:venue.availability};
 return summary;
}
