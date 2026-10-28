import {mediaHosts} from '../game-report-media.js';
export function hmsSponsorImage(value){
  if(typeof value!=='string'||value.length>2048)return null;
  try{const u=new URL(value);return u.protocol==='https:'&&mediaHosts.includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&!value.includes('[size]')?u.href:null;}catch{return null;}
}
// Only explicit original/uncropped fields qualify as an original. Never invent a
// suffix from a cropped URL or claim the square thumbnail is the source asset.
export function sponsorLogo(record){
  const variants=Object.fromEntries(Object.entries(record.logoUrls??{}).filter(([key,value])=>/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)&&hmsSponsorImage(value)).map(([key,value])=>[key,hmsSponsorImage(value)]));
  const originalUrl=[record.logo?.originalUrl,record.originalLogoUrl,record.logoOriginalUrl,variants.original,variants.originalUrl,variants.uncropped].map(hmsSponsorImage).find(Boolean)??null;
  const displayUrl=originalUrl??[variants.lg,variants.md,variants.sm,record.logo?.displayUrl,record.logoUrl,record.imageUrls?.md].map(hmsSponsorImage).find(Boolean)??null;
  const rawCrop=record.logo?.crop??record.logoCrop??record.crop;
  const crop=rawCrop&&typeof rawCrop==='object'?Object.fromEntries(['x','y','width','height','scale','rotation'].filter(k=>Number.isFinite(rawCrop[k])).map(k=>[k,rawCrop[k]])):null;
  return {originalUrl,displayUrl,overrideUrl:null,variants,crop:crop&&Object.keys(crop).length?crop:null,source:originalUrl?'hms-original':displayUrl?'hms-display':'missing'};
}
export function sponsorDisplayLogo(sponsor,override=null){return override||sponsor?.logo?.overrideUrl||sponsor?.logo?.originalUrl||sponsor?.logo?.displayUrl||sponsor?.logoUrl||null;}
export function sponsorSearch(items,query=''){
  const fold=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();
  const terms=fold(query).trim().split(/\s+/).filter(Boolean);
  return (items??[]).filter(s=>s.active!==false&&terms.every(term=>fold([s.name,s.nick,s.short,s.claim].join(' ')).includes(term)));
}
export async function fetchSponsorCatalog(org,{signal}={}){
  const response=await fetch('/api/sponsors?'+new URLSearchParams({org}),{cache:'no-store',credentials:'same-origin',signal:signal??AbortSignal.timeout(16000)});
  const data=await response.json();if(!response.ok)throw new Error('Sponsor catalog unavailable');
  if(data.org!==org||!Array.isArray(data.items))throw new Error('Sponsor organization mismatch');return data;
}
