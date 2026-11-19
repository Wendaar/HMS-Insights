// Organization-bound Closing read model. Never writes to HMS.
import {organizationConfig} from './organizations.js';
import {loadPortalHmsCatalog,loadPortalHmsSeason} from './portal-hms-catalog.js';
import {readDirectoryTeams,readOfficialStandings,readOfficialStatistics} from './broadcast-league.js';
import {officialPlayers} from '../../public/widgets/statistics.js';
import {closingScope} from '../domain/official-closing.js';

export async function closingCatalog(org,options={}){
 const config=organizationConfig(org,options.env??process.env);
 const items=await loadPortalHmsCatalog(config,options);
 if(!items)throw new Error('HMS hierarchy unavailable');
 return {items,source:'HMS organization-verified competition hierarchy'};
}
export async function closingContext(org,input,options={}){
 const config=organizationConfig(org,options.env??process.env),scope=closingScope(input);
 if(scope.organization!==config.slug)throw new TypeError('scope organization');
 const catalog=await closingCatalog(org,options),season=catalog.items.find(s=>s.seasonId===scope.seasonId&&s.competitionId===scope.competitionId);
 if(!season)throw new TypeError('scope season');
 const hierarchy=await loadPortalHmsSeason(config,scope.seasonId,options);
 if(!hierarchy)throw new Error('HMS hierarchy unavailable');
 const group=scope.groupId?hierarchy.groups.find(g=>g.id===scope.groupId):null;
 if(scope.groupId&&!group)throw new TypeError('scope group');
 const parents=hierarchy.groups.filter(g=>g.phases.some(p=>p.id===scope.phaseId));
 if(scope.phaseId&&(parents.length!==1||group&&parents[0].id!==group.id))throw new TypeError('scope phase');
 return {scope,season,groups:hierarchy.groups};
}
export async function closingSources(org,input,options={}){
 const context=await closingContext(org,input,options),{scope}=context;
 const tableScope=scope.phaseId?{phaseId:scope.phaseId}:scope.groupId?{groupId:scope.groupId}:{seasonId:scope.seasonId};
 const teams=await(options.readDirectoryTeams??readDirectoryTeams)(tableScope,options);
 if(!teams.length||teams.length>256)throw new Error('Closing membership unavailable');
 const [order,skaters,goalies]=await Promise.allSettled([
  scope.type==='competition'?Promise.reject(new Error('No verified combined competition placement')):(options.readOfficialStandings??readOfficialStandings)(tableScope,options),
  (options.readOfficialStatistics??readOfficialStatistics)(tableScope,'skater',options),
  (options.readOfficialStatistics??readOfficialStatistics)(tableScope,'goalie',options)
 ]);
 const teamIds=teams.map(t=>t.id),players=[];
 for(const [result,role]of [[skaters,'skater'],[goalies,'goalie']])if(result.status==='fulfilled'){
  for(const p of officialPlayers(result.value))if(teamIds.includes(p.teamId))players.push({...p,playerId:p.id,role});
 }
 const standings=order.status==='fulfilled'?order.value:[];
 if(standings.some(t=>!teamIds.includes(t.id))||new Set(standings.map(t=>t.id)).size!==standings.length)throw new Error('Standings membership mismatch');
 const suggestions=standings.map(t=>({teamId:t.id,rank:t.rank,medal:null}));
 const nominations=Object.fromEntries(['points','goals','assists'].map(category=>{
  const ranked=players.filter(p=>p.role==='skater'&&p.games>0&&Number.isFinite(p[category])).sort((a,b)=>b[category]-a[category]);
  return [category,ranked.length?ranked.filter(p=>p[category]===ranked[0][category]).map(p=>({playerId:p.playerId,teamId:p.teamId,value:p[category]})):[]];
 }));
 return {...context,teams,players,suggestions,nominations,eligibility:{teamIds,playerTeamPairs:players},
  provenance:{source:'HMS official public standings and statistics',readAt:new Date().toISOString(),tableScope,
   orderBasis:standings.length?'HMS table row order; not certified final placement':'Manual placement required',
   coverage:{membership:true,standings:standings.length===teams.length,skaters:skaters.status==='fulfilled',goalies:goalies.status==='fulfilled'},
   suggestedStandings:suggestions,finalityVerified:false,tiesVerified:false,warning:'Review finality, ties and coverage. Table order is a suggestion. MVP, goalie and defenseman require manual choice.'}};
}
