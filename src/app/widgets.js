import {organizationConfig} from './organizations.js';
import {portalCatalog,portalDirectory,portalBranding} from './public-portal.js';
import {readOfficialStatistics} from './broadcast-league.js';
import {playerCard} from './player-card.js';
import {resolveWidgetContext,metrics,widgetScope} from '../../public/widgets/definitions.js';
import {officialPlayers,rankLeaders} from '../../public/widgets/statistics.js';
import {availableWidgetPhases} from '../../public/widgets/scope-options.js';
const contextCache=new Map(),contextPending=new Map();
async function contextData(key,loader,options){
 if(options.sql||Object.values(options).some(v=>typeof v==='function'))return loader();
 if(contextCache.get(key)?.until>Date.now())return contextCache.get(key).value;
 if(contextPending.has(key))return contextPending.get(key);if(contextPending.size>=16)throw new Error('Widget context busy');
 const task=(async()=>{const value=await loader();if(contextCache.size>=100)contextCache.delete(contextCache.keys().next().value);contextCache.set(key,{value,until:Date.now()+60000});return value;})();contextPending.set(key,task);try{return await task;}finally{contextPending.delete(key);}
}

// Scope ownership is checked before using any public HMS statistics endpoint.
export async function widgetContext(org,input={},options={}){
 const organization=organizationConfig(org,options.env??process.env),catalog=await contextData(organization.id+':catalog',()=>(options.portalCatalog??portalCatalog)(org,options),options);
 const explicit=widgetScope(input);
 if(explicit.organisationId&&explicit.organisationId!==organization.id.toLowerCase())throw new TypeError('Foreign widget organisation');
 const candidates=catalog.items.filter(s=>!explicit.competitionId||s.competitionId===explicit.competitionId);
 const season=candidates.find(s=>s.seasonId===explicit.seasonId)??(!explicit.seasonId?candidates.find(s=>s.seasonId===options.defaultSeasonId)??candidates[0]:null);
 if(!season)throw new TypeError('Unknown widget season/competition');
 const scope={...resolveWidgetContext(explicit),organisationId:organization.id.toLowerCase(),seasonId:season.seasonId,competitionId:season.competitionId};
 const directory=await contextData(organization.id+':directory:'+season.seasonId,()=>(options.portalDirectory??portalDirectory)(org,season.seasonId,options),options);
 const group=scope.groupId?directory.groups.find(g=>g.id===scope.groupId):null;
 const phase=scope.phaseId?directory.groups.flatMap(g=>g.phases.map(p=>({...p,group:g}))).find(p=>p.id===scope.phaseId):null;
 const team=scope.teamId?directory.teams.find(t=>t.id===scope.teamId):null;
 if(scope.groupId&&!group||scope.phaseId&&(!phase||group&&phase.group.id!==group.id)||scope.teamId&&(!team||group&&!team.groupIds.includes(group.id)||phase&&(!team.groupIds.includes(phase.group.id)||phase.teamIds?.length&&!phase.teamIds.includes(team.id))))throw new TypeError('Unknown widget group/phase/team');
 if(phase&&!scope.groupId)scope.groupId=phase.group.id;
 let branding=null;try{branding=await(options.portalBranding??portalBranding)(org,season,options);}catch{/* Identity is optional. */}
 const effectiveGroup=group??phase?.group,competitionLogoUrl=branding?.competition?.logoUrl??season.competitionLogoUrl??null;
 return {scope,season,organization,directory,branding:{name:team?.name??(effectiveGroup?season.competition+' · '+effectiveGroup.name:season.competition),phase:phase?.name??null,logoUrl:team?.logoUrl??effectiveGroup?.logoUrl??competitionLogoUrl,color:effectiveGroup?.color??null,competitionLogoUrl,organizationLogoUrl:branding?.organization?.logoUrl??null}};
}
export async function readWidgetScopeCatalog(org,input,options={}){
 const context=await widgetContext(org,input,options);
 return {organization:{name:context.organization.name,id:context.organization.id.toLowerCase()},season:context.season,groups:context.directory.groups,teams:context.directory.teams,source:'imported-hms-games'};
}
export function visitorPhaseScope(context,input){
 if(input.visitorPhaseId===undefined)return context.scope;
 if(input.allowPhaseSwitching!=='true'||context.scope.phaseId)throw new TypeError('Locked phase scope');
 const phases=availableWidgetPhases(context);
 if(!phases.length)throw new TypeError('Phase switching unavailable');
 if(input.visitorPhaseId==='all')return {...context.scope,phaseId:null};
 const phase=phases.find(p=>p.id===input.visitorPhaseId?.toLowerCase());if(!phase)throw new TypeError('Foreign visitor phase');
 return {...context.scope,phaseId:phase.id,groupId:phase.groupId};
}
export async function readWidgetLeaders(org,input,options={}){
 const metric=input.metric??'points',limit=Number(input.limit??5);
 if(!Object.hasOwn(metrics,metric)||![5,10].includes(limit))throw new TypeError('Widget metric/limit');
 const base=await widgetContext(org,input,options),scope=visitorPhaseScope(base,input),context=scope.phaseId!==base.scope.phaseId?await widgetContext(org,scope,options):base,role=metrics[metric].role;
 const rows=await readOfficialStatistics(context.scope,role,options);
 const allowed=new Map(context.directory.teams.map(t=>[t.id,t]));
 const players=officialPlayers(rows).filter(p=>allowed.has(p.teamId)&&(!context.scope.teamId||context.scope.teamId===p.teamId)).map(p=>({...p,team:p.team||allowed.get(p.teamId).name,teamLogoUrl:p.teamLogoUrl??allowed.get(p.teamId).logoUrl}));
 return {scope:context.scope,branding:context.branding,metric,limit,source:'HMS',asOf:new Date().toISOString(),phaseOptions:input.allowPhaseSwitching==='true'?availableWidgetPhases(base):[],items:rankLeaders(players,metric,limit)};
}
export async function readWidgetPlayerCard(org,input,options={}){
 const role=input.role??'skater';if(!['skater','goalie'].includes(role))throw new TypeError('Player role');
 const context=await widgetContext(org,input,options),rows=await readOfficialStatistics(context.scope,role,options);
 const allowed=new Set(context.directory.teams.map(t=>t.id));
 const selected=rows.filter(r=>allowed.has(r.TeamId?.toLowerCase())&&(!context.scope.teamId||context.scope.teamId===r.TeamId?.toLowerCase()));
 const card=playerCard(selected,input.playerId,{competition_name:context.season.competition,season_name:context.season.season,group_name:context.branding.name},{role,source:'hms'});
 return card?{...card,scopeLabel:'selection'}:null;
}
