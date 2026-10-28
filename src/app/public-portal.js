import {neon} from '@neondatabase/serverless';
import {organizationConfig} from './organizations.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {loadSponsorCatalog} from './broadcast-sponsors.js';
import {fetchOrganization,fetchGameDetail,hmsConfigFromEnv} from '../hms/client.js';

export const portalSections=['home','venues','rules','system','teams','standings','statistics','goalies','disciplinaries','games','insights','comparison','extras'];
const text=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
const id=v=>isGameId(v)?v.toLowerCase():null;
const color=v=>/^#[a-f0-9]{6}$/i.test(v??'')?v:null;
const image=v=>sportingImage(v?.logoUrls?.md)??sportingImage(v?.imageUrls?.md)??sportingImage(v?.logoUrl);
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
 const rows=await(options.loadPortalSeasons??(async()=>(options.sql??neon((options.env??process.env).DATABASE_URL)).query(`SELECT DISTINCT ON (season_id) organization_id,competition_id,competition_name,season_id,season_name,game_id AS sample_game_id,
 event_snapshot #>> '{branding,competitionLogoUrl}' AS competition_logo_url,event_snapshot #>> '{branding,seasonLogoUrl}' AS season_logo_url,event_snapshot #>> '{branding,organizationLogoUrl}' AS organization_logo_url
 FROM games WHERE organization_id=$1::uuid AND competition_name IS NOT NULL AND season_name IS NOT NULL ORDER BY season_id,played_on DESC,game_id LIMIT 301`,[config.id])))();
 if(!Array.isArray(rows)||rows.length>300)throw new Error('catalog size');
 const items=new Map();
 for(const r of rows){if(id(r.organization_id)!==id(config.id)||!id(r.season_id)||!id(r.competition_id))throw new Error('catalog ownership');
  const item={seasonId:id(r.season_id),competitionId:id(r.competition_id),competition:text(r.competition_name),season:text(r.season_name),name:text(r.competition_name)+' · '+text(r.season_name),sampleGameId:id(r.sample_game_id),competitionLogoUrl:sportingImage(r.competition_logo_url),seasonLogoUrl:sportingImage(r.season_logo_url),organizationLogoUrl:sportingImage(r.organization_logo_url)};
  if(items.has(item.seasonId)&&items.get(item.seasonId).competitionId!==item.competitionId)throw new Error('ambiguous season');items.set(item.seasonId,item);
 }
 return {org:config.code,items:[...items.values()].sort((a,b)=>a.competition.localeCompare(b.competition,'cs')||b.season.localeCompare(a.season,'cs')),source:'imported-hms-seasons'};
}
const brandingCache=new Map(),brandingPending=new Map();
export async function portalBranding(org,season,options={}){
 const config=organizationConfig(org,options.env??process.env),key=[config.id,season.seasonId,season.sampleGameId].join(':');
 const cacheable=!options.fetchOrganization&&!options.fetchGameDetail;
 if(cacheable&&brandingCache.get(key)?.until>Date.now())return brandingCache.get(key).value;
 if(cacheable&&brandingPending.has(key))return brandingPending.get(key);
 if(brandingPending.size>=12)throw Error('Branding busy');
 const task=(async()=>{
  const fallback={organization:{name:config.name,logoUrl:season.organizationLogoUrl??null},competition:{logoUrl:season.competitionLogoUrl??null},season:{logoUrl:season.seasonLogoUrl??null}};
  if(!config.token&&!options.fetchOrganization)return fallback;
  const request={config:{...hmsConfigFromEnv({...options.env,HMS_API_TOKEN:config.token??'injected-test'}),timeoutMs:4000,retries:0}};
  const [orgResult,gameResult]=await Promise.allSettled([(options.fetchOrganization??fetchOrganization)(request),season.sampleGameId?(options.fetchGameDetail??fetchGameDetail)(season.sampleGameId,request):Promise.resolve(null)]);
  if(orgResult.status==='fulfilled'){
   if(id(orgResult.value?.organizationId)!==id(config.id))throw Error('Foreign organization branding');
   fallback.organization={name:text(orgResult.value.name)||config.name,logoUrl:image(orgResult.value)??fallback.organization.logoUrl};
  }
  if(gameResult.status==='fulfilled'&&gameResult.value){
   const game=gameResult.value,group=game.Group??game.Phase?.Group,s=game.Season??group?.Season,c=game.Competition??s?.Competition;
   if(id(game.organizationId)!==id(config.id)||id(game.seasonId??s?.seasonId)!==season.seasonId||id(game.competitionId??c?.competitionId)!==season.competitionId)throw Error('Foreign season branding');
   fallback.competition.logoUrl=image(c)??fallback.competition.logoUrl;fallback.season.logoUrl=image(s)??fallback.season.logoUrl;
  }
  if(cacheable){if(brandingCache.size>=64)brandingCache.delete(brandingCache.keys().next().value);brandingCache.set(key,{value:fallback,until:Date.now()+300000});}return fallback;
 })();
 if(cacheable){brandingPending.set(key,task);task.finally(()=>brandingPending.delete(key)).catch(()=>{});}return task;
}
export async function validatePortalSeasons(org,settings,options={}){
 const catalog=await(options.portalCatalog??portalCatalog)(org,options);
 if(!settings.seasonIds.every(s=>catalog.items.some(i=>i.seasonId===s)))throw new TypeError('foreign season');
 return catalog.items.filter(i=>settings.seasonIds.includes(i.seasonId));
}
export async function portalDirectory(org,seasonId,options={}){
 const config=organizationConfig(org,options.env??process.env);
 const rows=await(options.loadPortalDirectory??(async()=>(options.sql??neon((options.env??process.env).DATABASE_URL)).query(`SELECT DISTINCT g.organization_id,g.season_id,g.group_id,g.group_name,g.group_color,g.group_logo_url,g.phase_id,g.phase_name,g.home_team_id,g.home_team_name,g.away_team_id,g.away_team_name,g.venue_name,g.venue_logo_url,
 coalesce(h.team_logo_template_url,h.team_logo_url) AS home_logo_url,coalesce(a.team_logo_template_url,a.team_logo_url) AS away_logo_url
 FROM games g LEFT JOIN team_game_stats h ON h.game_id=g.game_id AND h.side='HOME' LEFT JOIN team_game_stats a ON a.game_id=g.game_id AND a.side='AWAY'
 WHERE g.organization_id=$1::uuid AND g.season_id=$2::uuid LIMIT 5001`,[config.id,seasonId])))();
 if(!Array.isArray(rows)||rows.length>5000)throw new Error('directory size');
 const teams=new Map(),venues=new Map(),groups=new Map();
 for(const r of rows){
  if(id(r.organization_id)!==id(config.id)||id(r.season_id)!==seasonId)throw new Error('directory ownership');
  for(const side of ['home','away'])if(id(r[side+'_team_id'])){
   const teamId=id(r[side+'_team_id']),team=teams.get(teamId)??{id:teamId,name:text(r[side+'_team_name']),logoUrl:null,groupIds:[]};
   team.logoUrl??=sportingImage(r[side+'_logo_url']);if(id(r.group_id)&&!team.groupIds.includes(id(r.group_id)))team.groupIds.push(id(r.group_id));teams.set(teamId,team);
  }
  if(text(r.venue_name))venues.set(text(r.venue_name),{name:text(r.venue_name),logoUrl:sportingImage(r.venue_logo_url)});
  if(id(r.group_id)){const g=groups.get(id(r.group_id))??{id:id(r.group_id),name:text(r.group_name),phases:[],logoUrl:null,color:null,teamIds:[]};
   g.logoUrl??=sportingImage(r.group_logo_url);g.color??=color(r.group_color);
   for(const side of ['home','away'])if(id(r[side+'_team_id'])&&!g.teamIds.includes(id(r[side+'_team_id'])))g.teamIds.push(id(r[side+'_team_id']));
   if(id(r.phase_id)&&!g.phases.some(p=>p.id===id(r.phase_id)))g.phases.push({id:id(r.phase_id),name:text(r.phase_name)});groups.set(g.id,g);}
 }
 return {teams:[...teams.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs')),teamCount:teams.size,venues:[...venues.values()],groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs')).map(g=>({...g,teamCount:g.teamIds.length})),source:'imported-hms-games'};
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
 if(section==='games')return '/game-center?'+new URLSearchParams({seasonId:season.seasonId,lang,embed:'1'});
 if(section==='comparison')return '/team-comparison/'+org.slug+'?'+new URLSearchParams({seasonId:season.seasonId,lang,embed:'1'});
 if(section==='insights')return '/priklepy/'+org.slug+'?'+new URLSearchParams({lang,embed:'1'});
 const endpoints={rules:'season_terms',standings:'standings',statistics:'players_stats',goalies:'goalies_stats',disciplinaries:'disciplinaries'};
 if(!endpoints[section])return null;
 embed.pathname+=endpoints[section];
 if(section==='rules')q.set('seasonId',season.seasonId);
 else {q.set(section==='disciplinaries'?'competitionId':'competitionIds',season.competitionId);if(section!=='disciplinaries')q.set('seasonId',season.seasonId);}
 embed.search=q;return embed.href;
}
