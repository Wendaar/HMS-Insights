import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeWidget,normalizeWidgets,resolveWidgetContext,widgetRegistry,portalWidgets,metrics} from '../public/widgets/definitions.js';
import {officialPlayers,rankLeaders} from '../public/widgets/statistics.js';
import {readOfficialStatistics,officialTeamLeaders} from '../src/app/broadcast-league.js';
import {widgetContext,readWidgetLeaders,readWidgetPlayerCard} from '../src/app/widgets.js';
import {portalSettings,validatePortalSeasons} from '../src/app/public-portal.js';
import {createWidgetsHandler} from '../src/web/widgets-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_PHM_ORGANIZATION_ID:id(1),HMS_EUCHL_ORGANIZATION_ID:id(2)};
const season={seasonId:id(10),competitionId:id(11),competition:'PHM Cup',season:'2026/27'};
const directory={teams:[{id:id(20),name:'PHM A',groupIds:[id(30)]},{id:id(21),name:'PHM B',groupIds:[id(31)]}],groups:[{id:id(30),name:'Skupina A',color:'#127b91',phases:[{id:id(40),name:'Fáze A'}]},{id:id(31),name:'Skupina B',phases:[{id:id(41),name:'Fáze B'}]}]};
const players=Array.from({length:7},(_,i)=>({PlayerId:id(100+i),TeamId:i===6?id(21):id(20),FirstName:['Jiří','Štěpán','Vojtěch'][i%3],LastName:['Říha','Němec','Ďuriš'][i%3],GP:3,G:7-i,A:i===2?4:3,P:10-i,Stars:i,PIM:i,W:7-i,GAA:i===0?0:i/2,SvP:99-i,SO:i===0?2:0,GA:i,Svs:20}));
function options(extra={}){return {env,portalCatalog:async()=>({items:[season]}),portalDirectory:async()=>directory,portalBranding:async()=>null,fetchImpl:async url=>({ok:true,json:async()=>url.searchParams.has('groupId')||url.searchParams.has('phaseId')||url.searchParams.has('phaseIds')?players.slice(0,6):players}),...extra};}
const widget=(patch={})=>normalizeWidget({widgetInstanceId:'points-1',widgetType:'leaders',...patch});
test('catalog exposes definitions, extensible metric schemas and supported scopes without builder special cases',()=>{
 assert.deepEqual(Object.keys(widgetRegistry),['insights','leaders']);assert.equal(Object.keys(metrics).length,9);
 for(const definition of Object.values(widgetRegistry))for(const key of ['widgetType','name','description','category','configSchema','supportedScopes','supportedDisplayModes','renderer','dataRequirements'])assert.ok(Object.hasOwn(definition,key));
 assert.equal(widget().limit,5);assert.equal(widget().metric,'points');assert.equal(widget().display.mode,'auto');
 assert.throws(()=>widget({metric:'constructor'}));assert.throws(()=>widget({limit:20}));assert.throws(()=>widget({widgetType:'toString'}));
});
test('instances retain independent identity, order, toggles and config while duplicate IDs are rejected',()=>{
 const list=normalizeWidgets([widget(),widget({widgetInstanceId:'goals-2',metric:'goals',limit:10,enabled:false})]);assert.equal(list.length,2);assert.equal(list[1].limit,10);assert.equal(list[1].enabled,false);
 assert.throws(()=>normalizeWidgets([widget(),widget()]));assert.throws(()=>normalizeWidgets(Array(61).fill(widget())));
});
test('explicit scope wins over page and site, supports aliases and explicit clearing, and does not mutate contexts',()=>{
 const site={organizationId:id(1),seasonId:id(10),competitionId:id(11)},page={groupId:id(30),phaseId:id(40),teamId:id(20)},explicit={teamId:id(21),phaseId:null};
 assert.deepEqual(resolveWidgetContext(explicit,page,site),{organisationId:id(1),seasonId:id(10),competitionId:id(11),groupId:id(30),phaseId:null,teamId:id(21)});assert.equal(page.phaseId,id(40));assert.throws(()=>resolveWidgetContext({teamId:'injection'}));
});
test('legacy Insights becomes a normal registry instance and explicit empty widget lists stay empty',()=>{
 assert.equal(portalWidgets({sections:['home','insights']})[0].widgetType,'insights');assert.deepEqual(portalWidgets({sections:['home','insights'],widgets:[]}),[]);
 assert.throws(()=>normalizeWidget({widgetType:'insights',widgetInstanceId:'i',scope:{teamId:id(20)}}));
});
test('ranks share metric values before limiting (1, 2, T3, T3, 5) and preserve zero goalie GAA',()=>{
 const rows=officialPlayers(players),values=[10,9,8,8,6,5,4];rows.forEach((p,i)=>p.points=values[i]);
 const ranked=rankLeaders(rows,'points',5);assert.deepEqual(ranked.map(p=>p.rank),[1,2,3,3,5]);assert.deepEqual(ranked.map(p=>p.tied),[false,false,true,true,false]);
 assert.equal(rankLeaders(rows,'gaa',10)[0].value,0);assert.equal(rankLeaders(rows,'gaa',10).length,7);
 assert.equal(rankLeaders(rows,'pim',5)[0].pim,6);assert.equal(rankLeaders(rows,'savePercentage',5)[0].value,99);
 assert.equal(rankLeaders(rows.map(p=>({...p,games:0})),'gaa',10).length,0);
});
test('shared official projection agrees with Broadcast and excludes unsafe media, missing values and conflicting duplicates',()=>{
 const p=officialPlayers([{...players[0],PlayerLogo:'https://evil.example/private',email:'private'}])[0];assert.equal(p.imageUrl,null);assert.equal(p.email,undefined);
 assert.equal(p.points,officialTeamLeaders(players,{homeTeamId:id(20),awayTeamId:id(21)}).home[0].points);
 assert.equal(officialPlayers([players[0],players[0]]).length,1);assert.throws(()=>officialPlayers([players[0],{...players[0],G:100}]));
 assert.equal(rankLeaders(officialPlayers([{...players[0],SvP:null}]),'savePercentage').length,0);
});
test('same-scope metrics coalesce their official table request across concurrent consumers and use fixed-host credential-free queries',async()=>{
 let calls=0;const fetchImpl=async(url,init)=>{calls++;assert.equal(url.hostname,'api.prod.hms.wootera.net');assert.equal(url.searchParams.get('seasonId'),id(10));assert.equal(init.headers.authorization,undefined);await new Promise(r=>setTimeout(r,5));return {ok:true,json:async()=>players};};
 await Promise.all(Array.from({length:5},()=>readOfficialStatistics({seasonId:id(10)},'skater',{fetchImpl})));assert.equal(calls,1);
 await readOfficialStatistics({seasonId:id(10)},'skater',{fetchImpl});assert.equal(calls,1);
});
test('failed official fetches retry and malformed or oversized data is rejected',async()=>{
 let calls=0;const fetchImpl=async()=>({ok:++calls>1,json:async()=>[]});await assert.rejects(()=>readOfficialStatistics({groupId:id(30)},'skater',{fetchImpl}));assert.deepEqual(await readOfficialStatistics({groupId:id(30)},'skater',{fetchImpl}),[]);
 for(const value of [{private:'no'},Array(20001).fill({})])await assert.rejects(()=>readOfficialStatistics({groupId:id(30)},'skater',{fetchImpl:async()=>({ok:true,json:async()=>value})}));
});
test('A/B: homepage Points and Goals instances use the same organization and competition data',async()=>{
 const opt=options(),context={seasonId:id(10),competitionId:id(11)};
 const [a,b]=await Promise.all([readWidgetLeaders('phm',{...context,metric:'points',limit:5},opt),readWidgetLeaders('phm',{...context,metric:'goals',limit:10},opt)]);
 assert.equal(a.items.length,5);assert.equal(b.items.length,7);assert.equal(a.items[0].name,'Jiří Říha');assert.equal(a.scope.organisationId,id(1));assert.equal(b.metric,'goals');
});
test('C/D: Group inheritance and future Team context use one Leaders reader',async()=>{
 const inherited=resolveWidgetContext({}, {seasonId:id(10),competitionId:id(11),groupId:id(30)});
 const c=await readWidgetLeaders('phm',{...inherited,metric:'assists'},options());assert.equal(c.scope.groupId,id(30));assert.equal(c.branding.color,'#127b91');assert.equal(c.items[0].assists,4);
 const d=await readWidgetLeaders('phm',{seasonId:id(10),teamId:id(21),metric:'points'},options());assert.equal(d.items.length,1);assert.equal(d.items[0].teamId,id(21));
});
test('E: GAA uses official goalie values, ascending order, known source eligibility and correct phase endpoint',async()=>{
 let url;const result=await readWidgetLeaders('phm',{seasonId:id(10),phaseId:id(40),metric:'gaa',limit:10},options({fetchImpl:async u=>{url=u;return {ok:true,json:async()=>players.slice(0,6)};}}));
 assert.equal(result.items[0].gaa,players[0].GAA);assert.equal(result.items[0].rank,1);assert.equal(result.items.length,6);assert.equal(url.searchParams.get('phaseId'),id(40));assert.equal(result.scope.groupId,id(30));
});
test('ownership and hierarchy are verified before fetching tables, including incompatible group and phase overrides',async()=>{
 let requested=0;const opt=options({fetchImpl:async()=>{requested++;throw Error('must not fetch');}});
 for(const input of [{organisationId:id(2)},{seasonId:id(99)},{competitionId:id(99)},{groupId:id(99)},{groupId:id(30),phaseId:id(41)},{groupId:id(30),teamId:id(21)}])await assert.rejects(()=>readWidgetLeaders('phm',input,opt),TypeError);
 assert.equal(requested,0);await assert.rejects(()=>widgetContext('unknown',{},opt),TypeError);
});
test('F: Leaders uses the existing Player Card model and exact team selection without copying private records',async()=>{
 const card=await readWidgetPlayerCard('phm',{seasonId:id(10),teamId:id(20),playerId:id(100)},options());assert.equal(card.name,'Jiří Říha');assert.equal(card.stats.P,10);assert.equal(card.scopeLabel,'selection');
 assert.equal(await readWidgetPlayerCard('phm',{seasonId:id(10),teamId:id(21),playerId:id(100)},options()),null);
 const report=await readFile(new URL('../public/game-report.js',import.meta.url),'utf8'),widgets=await readFile(new URL('../public/widgets/renderers.js',import.meta.url),'utf8');assert.match(report,/createPlayerCard/);assert.match(widgets,/createPlayerCard/);assert.match(widgets,/import \{portrait\} from '..\/player-portrait.js'/);
});
test('Player Card preserves the same official goalie rates as Leaders instead of replacing rounded HMS values',async()=>{
 const opt=options(),input={seasonId:id(10),teamId:id(20),playerId:id(100),role:'goalie'};
 const card=await readWidgetPlayerCard('phm',input,opt),gaa=await readWidgetLeaders('phm',{...input,metric:'gaa'},opt),sv=await readWidgetLeaders('phm',{...input,metric:'savePercentage'},opt);
 assert.equal(card.stats.GAA,gaa.items[0].value);assert.equal(card.stats.SvP,sv.items[0].value);
});
test('widget settings persist through portal validation and reject unpublished seasons and foreign organisations',async()=>{
 const config=portalSettings({title:'PHM',seasonIds:[id(10)],defaultSeasonId:id(10),sections:['home'],color:'#127b91',extras:'',widgets:[widget(),widget({widgetInstanceId:'goals-2',metric:'goals',limit:10})]});assert.equal(config.widgets.length,2);
 await validatePortalSeasons('phm',config,options());
 for(const scope of [{seasonId:id(99)},{organisationId:id(2)},{competitionId:id(99)},{groupId:id(30),phaseId:id(41)}])await assert.rejects(()=>validatePortalSeasons('phm',{...config,widgets:[widget({scope})]},options()),TypeError);
});
test('read-only widget API rejects bad methods, unknown tenants and invalid actions without leaking internal errors',async()=>{
 const handler=createWidgetsHandler(options()),call=async(query,method='GET')=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;}};await handler({method,query},res);return res;};
 assert.equal((await call({org:'phm'})).code,200);assert.equal((await call({org:'phm'},'POST')).code,405);assert.equal((await call({org:'unknown'})).code,404);assert.equal((await call({org:'phm',action:'publish'})).code,400);assert.equal((await call({org:'phm',metric:'private'})).code,400);
});
test('G: local standalone and widget assets share routes and preserve portal framing policy',async()=>{
 const {server}=await import('../src/server.js');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base='http://127.0.0.1:'+server.address().port;for(const path of ['/widgets/leaders/phm','/widgets/definitions.js','/widgets/statistics.js','/widgets/renderers.js','/widgets/picker.js','/widgets/styles.css','/player-card.js','/player-card.css','/player-portrait.js']){const r=await fetch(base+path);assert.equal(r.status,200,path);if(path==='/widgets/leaders/phm')assert.match(r.headers.get('content-security-policy'),/frame-ancestors \*/);}
 const api=await fetch(base+'/api/widgets?org=unknown');assert.equal(api.status,404);
 const hosting=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));assert.ok(hosting.rewrites.some(r=>r.source==='/api/widgets'&&r.destination.includes('view=widgets')));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
