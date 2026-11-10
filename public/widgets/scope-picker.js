import {resolveWidgetContext} from './definitions.js';
import {allScopeValue,chooseWidgetScope,scopedEntities} from './scope-options.js';
export async function mountScopePicker(root,{widget,site,seasons,loadScope,onChange,organizationName}){
 const scope=widget.scope,current=resolveWidgetContext(scope,{},site),season=seasons.find(s=>s.seasonId===current.seasonId),competition=seasons.find(s=>s.competitionId===current.competitionId);
 const grid=document.createElement('div');grid.className='form-grid widget-scope-grid';root.append(grid);
 function select(key,label,items,inherited,all){
  const wrapper=document.createElement('label'),control=document.createElement('select');wrapper.append(document.createTextNode(label),control);control.dataset.scopeSelect=key;
  control.add(new Option(inherited?`Zdědit · ${inherited}`:'Zdědit z kontextu',''));
  if(all)control.add(new Option(all,allScopeValue));
  for(const item of items)control.add(new Option(item.label??item.name,item.id));
  const value=Object.hasOwn(scope,key)?scope[key]===null?allScopeValue:scope[key]:'';
  if(![...control.options].some(o=>o.value===value))control.add(new Option('Nedostupný výběr · změňte rozsah',value));
  control.value=value;control.onchange=()=>{widget.scope=chooseWidgetScope(widget.scope,key,control.value,{site,seasons});onChange();};grid.append(wrapper);return control;
 }
 const org=document.createElement('p');org.className='muted';org.textContent='Organizace · '+organizationName;root.prepend(org);
 const competitions=[...new Map(seasons.map(s=>[s.competitionId,{id:s.competitionId,name:s.competition}])).values()];
 select('competitionId','Soutěž',competitions,competition?.competition);
 select('seasonId','Sezona',seasons.filter(s=>!current.competitionId||s.competitionId===current.competitionId).map(s=>({id:s.seasonId,name:s.season})),season?.season);
 const status=document.createElement('p');status.className='muted';status.setAttribute('role','status');status.textContent='Načítám skupiny, fáze a týmy…';root.append(status);
 if(!current.seasonId){status.textContent='Nejprve vyberte sezonu webu.';return;}
 try{
  const directory=await loadScope(current.seasonId);if(!root.isConnected)return;
  const entities=scopedEntities(directory,scope,site);status.textContent='Skupiny, fáze a týmy z dostupných HMS zápasů této sezony.';
  select('groupId','Skupina',entities.groups,null,'Všechny skupiny');
  select('phaseId','Fáze',entities.phases.map(p=>({id:p.id,name:p.label})),null,'Všechny fáze');
  select('teamId','Tým',entities.teams,null,'Všechny týmy');
  org.textContent='Organizace · '+directory.organization.name;
 }catch{if(!root.isConnected)return;status.textContent='Skupiny a týmy se nepodařilo načíst. Nastavení zůstalo zachované.';const retry=document.createElement('button');retry.type='button';retry.textContent='Zkusit načíst znovu';retry.onclick=()=>{root.replaceChildren();mountScopePicker(root,{widget,site,seasons,loadScope,onChange,organizationName});};root.append(retry);}
}
