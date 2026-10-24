import {isGameId} from '../domain/game-summary.js';

const defaults=[{code:'PHM',slug:'phm',name:'PHM'},{code:'EUCHL',slug:'euchl',name:'EUCHL'},{code:'YHG',slug:'yhg',name:'YHG'},{code:'BNHLH',slug:'bnhlh',name:'BNHLH'}];
export const PHM_ORGANIZATION_ID='BB669217-41EB-4162-8040-A73F49A43570';
// Server-owned registry: public labels only. Tokens and UUIDs are separate env vars.
// Unknown paths/codes never fall back to PHM or become environment variable names.
export function organizationRegistry(env=process.env){
  let extra=[];
  try{extra=JSON.parse(env.HMS_STUDIO_ORGANIZATIONS||'[]');}catch{throw new Error('Invalid organization registry.');}
  if(!Array.isArray(extra)||extra.length>32)throw new Error('Invalid organization registry.');
  const map=new Map(defaults.map(o=>[o.code,{...o}]));
  for(const o of extra){
    if(!o||!/^([A-Z][A-Z0-9_]{1,23})$/.test(o.code)||!/^([a-z][a-z0-9-]{1,39})$/.test(o.slug)||typeof o.name!=='string'||!o.name.trim()||o.name.length>80||/[\x00-\x1f<>]/.test(o.name))throw new Error('Invalid organization registry.');
    map.set(o.code,{code:o.code,slug:o.slug,name:o.name.trim()});
  }
  const entries=[...map.values()],slugs=new Set();
  for(const o of entries){if(slugs.has(o.slug))throw new Error('Duplicate organization slug.');slugs.add(o.slug);}
  return entries;
}
export function organizationEntry(value,env=process.env){
  if(typeof value!=='string')throw new TypeError('Neplatná organizace.');
  const entry=organizationRegistry(env).find(o=>o.code===value||o.slug===value.toLowerCase());
  if(!entry)throw new TypeError('Neplatná organizace.');
  return entry;
}
export function organizationConfig(org,env=process.env){
  const entry=organizationEntry(org,env),prefix=`HMS_${entry.code}_`;
  const id=env[prefix+'ORGANIZATION_ID']||(entry.code==='PHM'?PHM_ORGANIZATION_ID:null);
  if(!isGameId(id))throw new Error('Organizace zatím nemá nastavené datové připojení.');
  return {...entry,id,token:env[prefix+'API_TOKEN']?.trim()||(entry.code==='PHM'?env.HMS_API_TOKEN?.trim():undefined),webhookSecret:env[prefix+'WEBHOOK_SECRET']?.trim()||(entry.code==='PHM'?env.HMS_WEBHOOK_SECRET?.trim():undefined)};
}
export function publicOrganizations(env=process.env){
  return organizationRegistry(env).map(entry=>{let configured=false;try{configured=!!organizationConfig(entry.code,env).token;}catch{/* Unconfigured entries remain explicit. */}return {...entry,configured};});
}

// Resolve stored ownership without guessing a league from its display name.
export function organizationForId(id,env=process.env){
  if(!isGameId(id))return null;
  for(const entry of organizationRegistry(env)){try{const config=organizationConfig(entry.code,env);if(config.id.toLowerCase()===id.toLowerCase())return config;}catch{/* Unconfigured organizations are not a fallback. */}}
  return null;
}
