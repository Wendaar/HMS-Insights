// Serializable definitions shared by the builder, public renderer and server.
export const scopeKeys=['organisationId','seasonId','competitionId','groupId','phaseId','teamId'];
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export const metrics={
 points:{field:'points',role:'skater',cs:'Body',en:'Points',direction:-1},
 goals:{field:'goals',role:'skater',cs:'Góly',en:'Goals',direction:-1},
 assists:{field:'assists',role:'skater',cs:'Asistence',en:'Assists',direction:-1},
 stars:{field:'stars',role:'skater',cs:'Hvězdy',en:'Stars',direction:-1,tieBreak:'sourceOrder'},
 pim:{field:'pim',role:'skater',cs:'Trestné minuty',en:'PIM',direction:-1,neutral:true},
 wins:{field:'wins',role:'goalie',cs:'Výhry',en:'Wins',direction:-1},
 gaa:{field:'gaa',role:'goalie',cs:'GAA',en:'GAA',direction:1,digits:2},
 shutouts:{field:'shutouts',role:'goalie',cs:'Čistá konta',en:'Shutouts',direction:-1},
 savePercentage:{field:'sv',role:'goalie',cs:'Úspěšnost %',en:'Save %',direction:-1,digits:2},
};
export const widgetRegistry={
 insights:{widgetType:'insights',name:'Insights / Příklepy',description:'To nejlepší z ledu · veřejný výběr organizace.',category:'Content',icon:'✦',supportedScopes:['organisationId'],supportedDisplayModes:['auto'],renderer:'insights',dataRequirements:['public-insights'],configSchema:{}},
 leaders:{widgetType:'leaders',name:'Leaders',description:'Jedna statistika, TOP 5 nebo TOP 10. Hráči i brankáři.',category:'Statistics',icon:'#',supportedScopes:scopeKeys,supportedDisplayModes:['auto','standard','compact'],renderer:'leaders',dataRequirements:['official-player-statistics'],configSchema:{metric:{enum:Object.keys(metrics),default:'points'},limit:{enum:[5,10],default:5},displayMode:{enum:['auto','standard','compact'],default:'auto'}}},
};
export function widgetScope(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('widget scope');
 const result={};
 for(const key of scopeKeys){const value=Object.hasOwn(input,key)?input[key]:(key==='organisationId'?input.organizationId:undefined);if(value===undefined||value==='')continue;if(value===null){result[key]=null;continue;}if(!uuid(value))throw new TypeError('widget '+key);result[key]=value.toLowerCase();}
 return result;
}
// Null explicitly clears an inherited constraint. Missing fields inherit.
export function resolveWidgetContext(explicit={},page={},site={}){return {...widgetScope(site),...widgetScope(page),...widgetScope(explicit)};}
export function normalizeWidget(input){
 if(!input||!Object.hasOwn(widgetRegistry,input.widgetType)||typeof input.widgetInstanceId!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(input.widgetInstanceId))throw new TypeError('widget instance');
 const scope=widgetScope(input.scope),display=input.display??{},mode=display.mode??'auto';
 if(typeof display!=='object'||Array.isArray(display)||input.enabled!==undefined&&typeof input.enabled!=='boolean'||['showPlayerPhoto','showTeamLogo','showScopeBranding'].some(k=>display[k]!==undefined&&typeof display[k]!=='boolean'))throw new TypeError('widget display/enabled');
 if(!widgetRegistry[input.widgetType].supportedDisplayModes.includes(mode))throw new TypeError('widget display');
 const placement=input.placement??'home';if(!['home','competition','group','phase'].includes(placement))throw new TypeError('widget placement');
 const layout=input.layout??{},section=layout.section??'bottom',width=layout.width??'full';
 if(!['top','main','bottom'].includes(section)||!['full','half','third'].includes(width))throw new TypeError('widget layout');
 const result={widgetInstanceId:input.widgetInstanceId,widgetType:input.widgetType,enabled:input.enabled!==false,placement,scope,layout:{section,width},display:{mode,showPlayerPhoto:display.showPlayerPhoto!==false,showTeamLogo:display.showTeamLogo!==false,showScopeBranding:display.showScopeBranding!==false}};
 if(input.widgetType==='insights'&&Object.keys(scope).some(k=>k!=='organisationId'&&scope[k]))throw new TypeError('Insights supports organisation scope only');
 if(input.widgetType==='leaders'){
  const metric=input.metric??'points',limit=input.limit??5;if(!Object.hasOwn(metrics,metric)||![5,10].includes(limit))throw new TypeError('widget metric/limit');
  result.metric=metric;result.limit=limit;
  if(input.allowPhaseSwitching!==undefined&&typeof input.allowPhaseSwitching!=='boolean')throw new TypeError('widget phase switching');
  result.allowPhaseSwitching=input.allowPhaseSwitching===true;
  // Reserved for competition-owned eligibility rules. V1 applies HMS eligibility.
  if(input.eligibility!=null&&Object.keys(input.eligibility).length)throw new TypeError('Eligibility rules are not configured in V1');
 }
 return result;
}
export function normalizeWidgets(input){
 if(!Array.isArray(input)||input.length>60)throw new TypeError('widgets');
 const ids=new Set();return input.map(w=>{const value=normalizeWidget(w);if(ids.has(value.widgetInstanceId))throw new TypeError('duplicate widget instance');ids.add(value.widgetInstanceId);return value;});
}
export function portalWidgets(config){return normalizeWidgets(config.widgets??(config.sections?.includes('insights')?[{widgetType:'insights',widgetInstanceId:'legacy-insights',placement:'home'}]:[]));}
export function newWidget(widgetType){return normalizeWidget({widgetType,widgetInstanceId:crypto.randomUUID()});}
