import {resolveWidgetContext} from './definitions.js';
export const allScopeValue='__all__';
export function scopedEntities(directory={},scope={},site={}){
 const effective=resolveWidgetContext(scope,{},site),groups=directory.groups??[],team=(directory.teams??[]).find(t=>t.id===effective.teamId);
 const phases=groups.filter(g=>!effective.groupId||g.id===effective.groupId).flatMap(g=>g.phases.map(p=>({...p,groupId:g.id,label:effective.groupId?p.name:g.name+' · '+p.name}))).filter(p=>!team?.phaseIds?.length||team.phaseIds.includes(p.id));
 const teams=(directory.teams??[]).filter(t=>(!effective.groupId||t.groupIds?.includes(effective.groupId))&&(!effective.phaseId||!t.phaseIds?.length||t.phaseIds.includes(effective.phaseId)));
 return {effective,groups,phases,teams};
}
// Called on a deliberate parent change, never while hydrating stored settings.
export function chooseWidgetScope(scope,key,value,{site={},seasons=[]}={}){
 const next={...scope};if(value==='')delete next[key];else next[key]=value===allScopeValue?null:value;
 if(key==='competitionId'){
  const competition=next.competitionId??site.competitionId,season=seasons.find(s=>s.competitionId===competition&&s.seasonId===site.seasonId)??seasons.find(s=>s.competitionId===competition);
  if(value==='')delete next.seasonId;else if(season)next.seasonId=season.seasonId;
 }
 if(['competitionId','seasonId'].includes(key))next.groupId=null;
 if(['competitionId','seasonId','groupId'].includes(key))next.phaseId=null;
 if(['competitionId','seasonId','groupId','phaseId'].includes(key))next.teamId=null;
 return next;
}
export function availableWidgetPhases(context){
 const {scope,directory}=context;if(scope.phaseId)return [];
 const phases=scopedEntities(directory,scope).phases;
 return phases.length>1?phases.map(p=>({id:p.id,name:p.label,groupId:p.groupId})):[];
}
