import {neon} from '@neondatabase/serverless';
import {organizationConfig} from './organizations.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {loadSponsorCatalog} from './broadcast-sponsors.js';

export const portalSections=['home','venues','rules','system','teams','standings','statistics','goalies','disciplinaries','games','insights','comparison','extras'];
const text=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
const id=v=>isGameId(v)?v.toLowerCase():null;
export function safePortalUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=1000?u.href:null;}catch{return null;}}
export function portalSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('settings');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>100)throw new TypeError('title');
 if(!Array.isArray(input.seasonIds)||!input.seasonIds.length||input.seasonIds.length>100||!input.seasonIds.every(isGameId))throw new TypeError('seasons');
 const seasonIds=[...new Set(input.seasonIds.map(id))];
 if(!seasonIds.includes(id(input.defaultSeasonId)))throw new TypeError('default season');
 if(!Array.isArray(input.sections)||!input.sections.every(s=>portalSections.includes(s))||new Set(input.sections).size!==input.sections.length||!input.sections.includes('home'))throw new TypeError('sections');
 if(!/^#[a-f0-9]{6}$/i.test(input.color??''))throw new TypeError('color');
 if(input.logoUrl&&!safePortalUrl(input.logoUrl))throw new TypeError('logo');
 if(typeof input.extras!=='string'||input.extras.length>30000)throw new TypeError('extras');
 return {title:input.title.trim(),description:text(input.description,600),color:input.color,logoUrl:safePortalUrl(input.logoUrl),seasonIds,defaultSeasonId:id(input.defaultSeasonId),sections:input.sections,lang:input.lang==='en'?'en':'cs',extras:input.extras};
}
export async function portalCatalog(org,options={}){
 const config=organizationConfig(org,options.env??process.env);
 const rows=await(options.loadPortalSeasons??(async()=>(options.sql??neon((options.env??process.env).DATABASE_URL)).query(`SELECT DISTINCT organization_id,competition_id,competition_name,season_id,season_name FROM games WHERE organization_id=$1::uuid AND competition_name IS NOT NULL AND season_name IS NOT NULL ORDER BY competition_name,season_name DESC LIMIT 301`,[config.id])))();
 if(!Array.isArray(rows)||rows.length>300)throw new Error('catalog size');
 const items=new Map();
 for(const r of rows){if(id(r.organization_id)!==id(config.id)||!id(r.season_id)||!id(r.competition_id))throw new Error('catalog ownership');
  const item={seasonId:id(r.season_id),competitionId:id(r.competition_id),competition:text(r.competition_name),season:text(r.season_name),name:text(r.competition_name)+' · '+text(r.season_name)};
  if(items.has(item.seasonId)&&items.get(item.seasonId).competitionId!==item.competitionId)throw new Error('ambiguous season');items.set(item.seasonId,item);
 }
 return {org:config.code,items:[...items.values()],source:'imported-hms-seasons'};
}
export async function validatePortalSeasons(org,settings,options={}){
 const catalog=await(options.portalCatalog??portalCatalog)(org,options);
 if(!settings.seasonIds.every(s=>catalog.items.some(i=>i.seasonId===s)))throw new TypeError('foreign season');
 return catalog.items.filter(i=>settings.seasonIds.includes(i.seasonId));
}
export async function portalDirectory(org,seasonId,options={}){
 const config=organizationConfig(org,options.env??process.env);
 const rows=await(options.loadPortalDirectory??(async()=>(options.sql??neon((options.env??process.env).DATABASE_URL)).query(`SELECT DISTINCT organization_id,season_id,group_id,group_name,phase_id,phase_name,home_team_id,home_team_name,away_team_id,away_team_name,venue_name,venue_logo_url FROM games WHERE organization_id=$1::uuid AND season_id=$2::uuid LIMIT 5001`,[config.id,seasonId])))();
 if(!Array.isArray(rows)||rows.length>5000)throw new Error('directory size');
 const teams=new Map(),venues=new Map(),groups=new Map();
 for(const r of rows){
  if(id(r.organization_id)!==id(config.id)||id(r.season_id)!==seasonId)throw new Error('directory ownership');
  for(const side of ['home','away'])if(id(r[side+'_team_id']))teams.set(id(r[side+'_team_id']),{id:id(r[side+'_team_id']),name:text(r[side+'_team_name']),logoUrl:null});
  if(text(r.venue_name))venues.set(text(r.venue_name),{name:text(r.venue_name),logoUrl:sportingImage(r.venue_logo_url)});
  if(id(r.group_id)){const g=groups.get(id(r.group_id))??{id:id(r.group_id),name:text(r.group_name),phases:[]};
   if(id(r.phase_id)&&!g.phases.some(p=>p.id===id(r.phase_id)))g.phases.push({id:id(r.phase_id),name:text(r.phase_name)});groups.set(g.id,g);}
 }
 return {teams:[...teams.values()],venues:[...venues.values()],groups:[...groups.values()],source:'imported-hms-games'};
}
export async function portalPartners(org,season,options={}){
 const config=organizationConfig(org,options.env??process.env),data=await(options.loadSponsorCatalog??loadSponsorCatalog)(config,options);
 const items=data.items.filter(s=>{
  const refs=s.scopeRefs??{};
  if(refs.seasonIds?.length&&!refs.seasonIds.includes(season.seasonId))return false;
  if(refs.competitionIds?.length&&!refs.competitionIds.includes(season.competitionId))return false;
  // Team/group/venue-specific partners are not promoted to organization-wide partners.
  return !['teamIds','groupIds','phaseIds','venueIds'].some(k=>refs[k]?.length);
 }).map(({id,name,claim,web,logoUrl})=>({id,name,claim,web,logoUrl}));
 return {items,teams:data.teams};
}
export function portalModule(section,org,season,lang='cs'){
 const q=new URLSearchParams({lang}),embed=new URL('https://prod.hms.wootera.net/embed/');
 if(section==='games')return '/game-center?'+new URLSearchParams({seasonId:season.seasonId,lang});
 if(section==='comparison')return '/team-comparison/'+org.slug+'?'+new URLSearchParams({seasonId:season.seasonId,lang,embed:'1'});
 if(section==='insights')return '/priklepy/'+org.slug+'?'+q;
 const endpoints={rules:'season_terms',standings:'standings',statistics:'players_stats',goalies:'goalies_stats',disciplinaries:'disciplinaries'};
 if(!endpoints[section])return null;
 embed.pathname+=endpoints[section];
 if(section==='rules')q.set('seasonId',season.seasonId);
 else {q.set(section==='disciplinaries'?'competitionId':'competitionIds',season.competitionId);if(section!=='disciplinaries')q.set('seasonId',season.seasonId);}
 embed.search=q;return embed.href;
}
