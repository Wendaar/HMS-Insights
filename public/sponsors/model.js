import {PUBLIC_ORIGIN} from '../public-output.js';
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
const bundledLogo='/sponsors/logos/restaurace-cerny-orel.png';
export function localSponsorAsset(value){
  try{const u=new URL(value);return !!globalThis.location&&u.origin===location.origin&&u.pathname===bundledLogo&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{return false;}
}
export function sponsorDisplayLogo(sponsor,override=null){
  const value=override||sponsor?.logo?.overrideUrl||sponsor?.logo?.originalUrl||sponsor?.logo?.displayUrl||sponsor?.logoUrl||null;
  try{const u=new URL(value);if(globalThis.location&&u.origin===PUBLIC_ORIGIN&&u.pathname===bundledLogo&&!u.search&&!u.hash)return new URL(u.pathname,location.origin).href;}catch{}
  return value;
}
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

export function publicImageUrl(value) {
  try {const u=new URL(value);const h=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||u.username||u.password||u.port||h==='localhost'||!h.includes('.')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localhost')||h.includes(':')||/^\d/.test(h)||h.endsWith('.test'))return null;
    return u.href;
  }catch{return null;}
}
export function sponsorOverrides(org){
  try{const value=JSON.parse(localStorage.getItem('hms-sponsor-logos:v1:'+org)||'{}');return Object.fromEntries(Object.entries(value).filter(([id,url])=>/^[a-f0-9-]{36}$/i.test(id)&&publicImageUrl(url)));}catch{return {};}
}
export function saveSponsorOverride(org,id,url){
  if(url&&!publicImageUrl(url))throw new TypeError('Public HTTPS logo URL required');
  const values=sponsorOverrides(org);if(url)values[id]=url;else delete values[id];localStorage.setItem('hms-sponsor-logos:v1:'+org,JSON.stringify(values));
}
export function withSponsorOverrides(catalog){const values=sponsorOverrides(catalog.org);return {...catalog,items:catalog.items.map(item=>({...item,logo:{...item.logo,overrideUrl:values[item.id]??item.logo?.overrideUrl??null}}))};}
