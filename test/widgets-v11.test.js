import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWidget,portalWidgets,resolveWidgetContext} from '../public/widgets/definitions.js';
import {chooseWidgetScope,scopedEntities,availableWidgetPhases,allScopeValue} from '../public/widgets/scope-options.js';
import {officialPlayers,rankLeaders} from '../public/widgets/statistics.js';
import {widgetContext,readWidgetLeaders,readWidgetScopeCatalog,visitorPhaseScope} from '../src/app/widgets.js';
import {createPublicPortalHandler} from '../src/web/public-portal-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_YHG_ORGANIZATION_ID:id(1),HMS_YHG_PORTAL_ADMIN_SECRET:'fixture-secret'};
const season={seasonId:id(10),competitionId:id(11),competition:'YHG Cup',season:'2026/27'};
const directory={teams:[{id:id(20),name:'Tým A',groupIds:[id(30)],phaseIds:[id(40),id(41)]},{id:id(21),name:'Tým B',groupIds:[id(31)],phaseIds:[id(42)]}],groups:[{id:id(30),name:'Sport Division',color:'#123456',phases:[{id:id(40),name:'Základní část',teamIds:[id(20)]},{id:id(41),name:'Play-off',teamIds:[id(20)]}]},{id:id(31),name:'Other Division',phases:[{id:id(42),name:'Other phase',teamIds:[id(21)]}]}]};
const players=[{PlayerId:id(100),TeamId:id(20),FirstName:'Zdeněk',LastName:'Žák',GP:2,G:3,A:1,Stars:3,GAA:1.5,SvP:95},{PlayerId:id(101),TeamId:id(20),FirstName:'Adam',LastName:'Říha',GP:2,G:1,A:1,Stars:3,GAA:3,SvP:90}];
const options=extra=>({env,portalCatalog:async()=>({items:[season]}),portalDirectory:async()=>directory,portalBranding:async()=>null,fetchImpl:async()=>({ok:true,json:async()=>players}),...extra});
const widget=patch=>normalizeWidget({widgetType:'leaders',widgetInstanceId:'test',...patch});
test('V1 instances retain Bottom/Full layout, original scopes and a disabled phase switch by default',()=>{
 const old=widget({scope:{phaseId:null}});assert.deepEqual(old.layout,{section:'bottom',width:'full'});assert.equal(old.allowPhaseSwitching,false);assert.equal(old.scope.phaseId,null);
 assert.equal(portalWidgets({sections:['home','insights']})[0].layout.section,'bottom');
 for(const patch of [{layout:{section:'wrong'}},{layout:{width:'quarter'}},{allowPhaseSwitching:'true'}])assert.throws(()=>widget(patch),TypeError);
 assert.equal(widget({layout:{section:'top',width:'third'},allowPhaseSwitching:true}).layout.width,'third');
});
test('scope picker lists named groups, relevant phases and teams and preserves explicit All versus inherited values',()=>{
 const e=scopedEntities(directory,{groupId:id(30)});assert.deepEqual(e.phases.map(p=>p.name),['Základní část','Play-off']);assert.deepEqual(e.teams.map(t=>t.name),['Tým A']);assert.equal(e.groups[0].name,'Sport Division');
 const inherited=chooseWidgetScope({phaseId:id(40)},'phaseId','');assert.equal(Object.hasOwn(inherited,'phaseId'),false);
 const all=chooseWidgetScope({},'phaseId',allScopeValue);assert.equal(all.phaseId,null);assert.equal(resolveWidgetContext(all,{phaseId:id(40)}).phaseId,null);
});
test('parent scope changes clear child constraints and competition changes select a matching named season',()=>{
 const old={groupId:id(30),phaseId:id(40),teamId:id(20)},changed=chooseWidgetScope(old,'groupId',id(31));assert.equal(changed.phaseId,null);assert.equal(changed.teamId,null);assert.equal(old.teamId,id(20));
 const next=chooseWidgetScope(old,'competitionId',id(12),{seasons:[season,{seasonId:id(13),competitionId:id(12)}],site:{seasonId:id(10)}});assert.equal(next.seasonId,id(13));assert.equal(next.groupId,null);
});
test('named YHG catalog uses owned HMS context, includes no credentials, and refuses other organizations',async()=>{
 const catalog=await readWidgetScopeCatalog('yhg',{seasonId:id(10)},options());assert.equal(catalog.organization.name,'YHG');assert.equal(catalog.groups[0].name,'Sport Division');assert.equal(catalog.teams[0].name,'Tým A');assert.equal(JSON.stringify(catalog).includes('fixture-secret'),false);
 await assert.rejects(()=>readWidgetScopeCatalog('yhg',{organisationId:id(2)},options()),TypeError);
});
test('widget catalog remains under the existing protected Site Builder policy',async()=>{
 const handler=createPublicPortalHandler(options({store:{get:async()=>null}}));
 const call=async secret=>{const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};await handler({method:'GET',query:{org:'yhg',action:'widget-catalog',seasonId:id(10)},headers:{authorization:'Bearer '+secret}},res);return res;};
 assert.equal((await call('wrong')).code,401);const result=await call('fixture-secret');assert.equal(result.code,200);assert.equal(result.body.groups[0].phases[0].name,'Základní část');
});
test('Group logo wins, falls back to competition logo, and phase identity retains its group color',async()=>{
 const logo='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/group.png',comp='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/competition.png';
 const context=await widgetContext('yhg',{seasonId:id(10),phaseId:id(40)},options({portalBranding:async()=>({competition:{logoUrl:comp}})}));assert.equal(context.branding.logoUrl,comp);assert.equal(context.branding.color,'#123456');assert.equal(context.branding.phase,'Základní část');assert.match(context.branding.name,/Sport Division/);
 const branded=await widgetContext('yhg',{seasonId:id(10),groupId:id(30)},options({portalDirectory:async()=>({...directory,groups:[{...directory.groups[0],logoUrl:logo}]})}));assert.equal(branded.branding.logoUrl,logo);
});
test('Stars ties mirror stable HMS table order without changing values, true ranks or team stints',()=>{
 const normalized=officialPlayers([...players,{...players[0],TeamId:id(21),Stars:2}]);const ranked=rankLeaders(normalized,'stars',10);assert.equal(ranked[0].name,'Zdeněk Žák');assert.deepEqual(ranked.map(p=>p.rank),[1,1,3]);assert.equal(ranked[1].stars,3);assert.equal(ranked.length,3);
});
test('public phase switching cannot escape the base group and never mutates that base context',async()=>{
 const context=await widgetContext('yhg',{seasonId:id(10),groupId:id(30)},options());assert.equal(availableWidgetPhases(context).length,2);
 const selected=visitorPhaseScope(context,{allowPhaseSwitching:'true',visitorPhaseId:id(41)});assert.equal(selected.phaseId,id(41));assert.equal(selected.groupId,id(30));assert.equal(context.scope.phaseId,undefined);
 for(const visitorPhaseId of [id(42),id(99),'invalid'])assert.throws(()=>visitorPhaseScope(context,{allowPhaseSwitching:'true',visitorPhaseId}),TypeError);
 assert.throws(()=>visitorPhaseScope(context,{visitorPhaseId:id(40)}),TypeError);
});
test('explicit or inherited phase locks cannot be cleared by visitor selection, including All',async()=>{
 const context=await widgetContext('yhg',{seasonId:id(10),phaseId:id(40)},options());assert.deepEqual(availableWidgetPhases(context),[]);
 for(const visitorPhaseId of ['all',id(40),id(41)])assert.throws(()=>visitorPhaseScope(context,{allowPhaseSwitching:'true',visitorPhaseId}),TypeError);
 const single=await widgetContext('yhg',{seasonId:id(10),groupId:id(31)},options());assert.deepEqual(availableWidgetPhases(single),[]);
});
test('Whole season uses the original group aggregate, phase uses its own endpoint, and all metrics retain their config',async()=>{
 const urls=[],opt=options({fetchImpl:async u=>{urls.push(u);return {ok:true,json:async()=>players};}}),input={seasonId:id(10),groupId:id(30),allowPhaseSwitching:'true',metric:'gaa',limit:10};
 const all=await readWidgetLeaders('yhg',{...input,visitorPhaseId:'all'},opt);assert.equal(urls[0].searchParams.get('groupId'),id(30));assert.equal(all.metric,'gaa');assert.equal(all.limit,10);assert.equal(all.phaseOptions.length,2);
 const phase=await readWidgetLeaders('yhg',{...input,visitorPhaseId:id(41)},opt);assert.equal(urls[1].searchParams.get('phaseId'),id(41));assert.equal(phase.scope.phaseId,id(41));assert.equal(phase.items[0].gaa,1.5);assert.equal(phase.phaseOptions.length,2);
 const count=urls.length;await assert.rejects(()=>readWidgetLeaders('yhg',{...input,visitorPhaseId:id(42)},opt),TypeError);assert.equal(urls.length,count);
});
