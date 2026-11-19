import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficialClosingHandler,closingStorageNamespace} from '../src/web/official-closing-handler.js';
import {closingCatalog,closingContext,closingSources} from '../src/app/official-closing.js';
import {toolStore} from '../src/infrastructure/tool-instances.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_PHM_ORGANIZATION_ID:id(1),HMS_EUCHL_ORGANIZATION_ID:id(2),HMS_PHM_TOOLS_ADMIN_SECRET:'phm-secret',HMS_EUCHL_TOOLS_ADMIN_SECRET:'euchl-secret'};
const scope={organization:'phm',competitionId:id(10),seasonId:id(11),type:'group',groupId:id(12)};
const teams=[{id:id(20),name:'A'},{id:id(21),name:'B'}];
const players=[{id:id(30),playerId:id(30),teamId:id(20),name:'Player A',role:'skater'},{id:id(31),playerId:id(31),teamId:id(21),name:'Goalie B',role:'goalie'}];
const settings=()=>({title:'Final',scope,standings:[{teamId:id(20),rank:1,medal:'gold'},{teamId:id(21),rank:2,medal:'silver'}],awards:[{category:'mvp',playerId:id(30),teamId:id(20)}]});
const source=()=>({scope,teams:structuredClone(teams),players:structuredClone(players),suggestions:[],eligibility:{teamIds:teams.map(t=>t.id),playerTeamPairs:players},provenance:{source:'HMS',readAt:'2026-11-18',coverage:{membership:true,standings:true,skaters:true,goalies:true},finalityVerified:false}});
function memory(){const rows=new Map();return {rows,async get(o,s){return structuredClone(rows.get(o+'|'+s)??null);},async list(o){return [...rows].filter(([k])=>k.startsWith(o+'|')).map(([k,v])=>({slug:k.split('|')[1],title:v.draft.config?.title,revision:v.revision}));},async save(o,s,d,r){const key=o+'|'+s,old=rows.get(key);if((old?.revision??0)!==r)return null;const next={draft:structuredClone(d),revision:r+1};rows.set(key,next);return structuredClone(next);}};}
function harness(extra={}){
 const store=memory(),options={env,store,closingSources:async(org,s)=>{if(org!=='PHM'||s.organization!=='phm')throw new TypeError('org');return source();},...extra},handler=createOfficialClosingHandler(options);
 async function call(action,body,query={},secret='phm-secret',headers={}){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};await handler({method:body?'POST':'GET',query:{org:'phm',instance:'final',action,...query},headers:{host:'localhost',authorization:'Bearer '+secret,...headers},body},res);return res;}
 return {call,store};
}
const approve=(revision,policy={})=>({revision,policy:{confirmFinal:true,...policy}});
test('Closing namespaces isolate production from every other environment',()=>{
 for(const VERCEL_ENV of [undefined,'preview','development','unknown'])assert.notEqual(closingStorageNamespace({VERCEL_ENV}),closingStorageNamespace({VERCEL_ENV:'production'}));
});
test('protected actions require the organization credential and same-origin requests',async()=>{
 const {call}=harness();for(const action of ['manage','review','catalog','context','sources'])assert.equal((await call(action,action==='review'?{revision:0}:undefined,{},'wrong')).code,401);
 assert.equal((await call('save',{revision:0,config:settings()},{},'euchl-secret')).code,401);
 assert.equal((await call('save',{revision:0,config:settings()},{},'phm-secret',{origin:'https://evil.example'})).code,403);
 assert.equal((await call('manage',undefined,{org:'unknown'})).code,404);
 assert.equal((await call('save',{revision:0,config:settings()},{org:'euchl'},'euchl-secret')).code,400);
 assert.equal((await call('public')).code,404);
});
test('CRUD is revision safe and public API never exposes a draft',async()=>{
 const {call}=harness();assert.equal((await call('save',{revision:0,config:settings()})).code,200);
 assert.equal((await call('public')).code,404);
 assert.equal((await call('save',{revision:0,config:settings()})).code,409);
 assert.equal((await call('delete',{revision:1})).code,200);
 assert.equal((await call('public')).code,404);
});
test('review validates a saved revision without changing or approving it',async()=>{
 const {call,store}=harness();await call('save',{revision:0,config:settings()});
 const result=await call('review',approve(1));assert.equal(result.code,200);assert.equal(result.body.review.valid,true);
 const row=await store.get('PHM','final');assert.equal(row.revision,1);assert.deepEqual(row.draft.versions,[]);
 assert.equal((await call('review',approve(0))).code,409);
});
test('approval requires complete placement, explicit final confirmation and correct medals',async()=>{
 const {call}=harness();const c=settings();c.standings.pop();await call('save',{revision:0,config:c});
 assert.equal((await call('approve',approve(1))).code,422);
 c.standings=settings().standings;c.standings[0].medal='silver';await call('save',{revision:1,config:c});
 assert.equal((await call('approve',approve(2))).code,422);
 await call('save',{revision:2,config:settings()});assert.equal((await call('approve',{revision:3})).code,422);
 assert.equal((await call('approve',approve(3))).code,200);
 assert.equal((await call('save',{revision:4,config:settings()})).code,423);
 assert.equal((await call('delete',{revision:4})).code,400);
});
test('unplaced teams can be saved as an incomplete draft but cannot be approved',async()=>{
 const {call}=harness(),config=settings();config.standings[1]={teamId:id(21),rank:null,medal:null};
 assert.equal((await call('save',{revision:0,config})).code,200);assert.equal((await call('approve',approve(1))).code,422);
 config.standings[1].rank=2;assert.equal((await call('save',{revision:1,config})).code,200);assert.equal((await call('approve',approve(2))).code,200);
});
test('duplicate teams, duplicate awards and invalid player/team pairs are rejected',async()=>{
 const {call}=harness();const configs=[{...settings(),standings:[settings().standings[0],settings().standings[0]]},{...settings(),awards:[settings().awards[0],settings().awards[0]]},{...settings(),awards:[{category:'mvp',playerId:id(30),teamId:id(21)}]},{...settings(),awards:[{category:'goalie',playerId:id(30),teamId:id(20)}]}];
 for(const config of configs)assert.equal((await call('save',{revision:0,config})).code,400);
});
test('joint placements are explicit policy and require an explanation',async()=>{
 const {call}=harness(),c=settings();c.standings[1]={...c.standings[1],rank:1,medal:'gold'};await call('save',{revision:0,config:c});
 assert.equal((await call('approve',approve(1))).code,422);
 assert.equal((await call('approve',approve(1,{allowTies:true}))).code,422);
 assert.equal((await call('approve',approve(1,{allowTies:true,reason:'Joint tournament champions'}))).code,200);
});
test('missing standings or statistics require acknowledged coverage and a reason',async()=>{
 const {call}=harness({closingSources:async()=>{const s=source();s.provenance.coverage.standings=false;return s;}});
 await call('save',{revision:0,config:settings()});assert.equal((await call('approve',approve(1))).code,422);
 assert.equal((await call('approve',approve(1,{acceptPartial:true,reason:'Official manual bracket reviewed'}))).code,200);
});
test('concurrent approval commits exactly one version with a single CAS write',async()=>{
 const {call,store}=harness();await call('save',{revision:0,config:settings()});
 const results=await Promise.all([call('approve',approve(1)),call('approve',approve(1))]);
 assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);assert.equal((await store.get('PHM','final')).draft.versions.length,1);
});
test('immutable public version survives source changes, reopening, revision and rollback',async()=>{
 let live=source();const {call}=harness({closingSources:async()=>structuredClone(live)});
 await call('save',{revision:0,config:settings()});await call('approve',approve(1));assert.equal((await call('public')).code,404);
 await call('publish',{revision:2,version:1});const original=(await call('public')).body;
 live.teams[0].name='Changed in HMS';live.players[0].name='Changed player';
 assert.deepEqual((await call('public')).body,original);
 assert.equal((await call('reopen',{revision:3,reason:'short'})).code,400);
 assert.equal((await call('reopen',{revision:3,reason:'Correct the approved ranking'})).code,200);
 const changed=settings();changed.standings.reverse();changed.standings.forEach((r,i)=>{r.rank=i+1;r.medal=null;});
 await call('save',{revision:4,config:changed});await call('approve',approve(5));assert.deepEqual((await call('public')).body,original);
 await call('publish',{revision:6,version:2});assert.equal((await call('public')).body.version,2);
 await call('publish',{revision:7,version:1});assert.deepEqual((await call('public')).body,original);
 await call('pause',{revision:8});assert.equal((await call('public')).code,404);
 assert.equal((await call('publish',{revision:9,version:99})).code,400);
 assert.equal(original.schemaVersion,1);for(const field of ['draft','config','events','approval','revision','policy'])assert.equal(Object.hasOwn(original,field),false);
});
test('source failure is not an empty success and approval revalidates eligibility',async()=>{
 let mode='ok';const {call}=harness({closingSources:async()=>{if(mode==='fail')throw Error('unavailable');const s=source();if(mode==='changed')s.eligibility.playerTeamPairs=[];return s;}});
 await call('save',{revision:0,config:settings()});mode='fail';assert.equal((await call('approve',approve(1))).code,503);
 mode='changed';assert.equal((await call('approve',approve(1))).code,400);
});
test('All Stars reference must be published in the same organization, season and group',async()=>{
 let pub=null;const allStarsStore={async get(org){assert.equal(org,'PHM');return pub;}};
 const {call}=harness({allStarsStore});await call('save',{revision:0,config:{...settings(),allStarsPublicationId:'october'}});
 assert.equal((await call('approve',approve(1))).code,400);
 pub={published:{seasonId:id(999),groupId:scope.groupId,output:{lineup:{}}}};assert.equal((await call('approve',approve(1))).code,400);
 pub.published.seasonId=scope.seasonId;assert.equal((await call('approve',approve(1))).code,200);
 await call('publish',{revision:2,version:1});const original=(await call('public')).body.allStars;pub.published.output.lineup.changed=true;
 assert.deepEqual((await call('public')).body.allStars,original);
});
const hms={env,fetchOrganization:async()=>({organizationId:id(1)}),fetchCompetitions:async()=>[{competitionId:id(10),name:'Tournament',Seasons:[{seasonId:id(11),name:'2026',Groups:[{groupId:id(12),name:'A',Phases:[{phaseId:id(13),name:'Final'}]},{groupId:id(14),name:'B',Phases:[{phaseId:id(15),name:'Other'}]}]}]}]};
test('HMS scope verifies organization, competition/season and phase-within-group parentage',async()=>{
 assert.equal((await closingCatalog('phm',hms)).items[0].competitionId,id(10));
 assert.equal((await closingContext('phm',{...scope,type:'phase',phaseId:id(13)},hms)).groups.length,2);
 for(const s of [{...scope,competitionId:id(999)},{...scope,seasonId:id(999)},{...scope,groupId:id(999)},{...scope,type:'phase',phaseId:id(15)}])await assert.rejects(()=>closingContext('phm',s,hms),TypeError);
 await assert.rejects(()=>closingCatalog('euchl',hms),/mismatch/);
});
test('official suggestions preserve table order, metric ties and explicit missing coverage',async()=>{
 const options={...hms,readDirectoryTeams:async()=>teams,readOfficialStandings:async()=>teams.map((p,i)=>({...p,rank:i+1})),readOfficialStatistics:async(s,role)=>role==='goalie'?[]:[{PlayerId:id(30),TeamId:id(20),FirstName:'Player',LastName:'A',GP:3,G:4,A:2,P:6},{PlayerId:id(32),TeamId:id(21),FirstName:'Player',LastName:'B',GP:3,G:4,A:1,P:5}]};
 const s=await closingSources('phm',scope,options);assert.deepEqual(s.suggestions.map(r=>r.rank),[1,2]);assert.equal(s.nominations.goals.length,2);assert.equal(s.provenance.finalityVerified,false);
 const c=await closingSources('phm',{...scope,type:'competition',groupId:undefined},options);assert.deepEqual(c.suggestions,[]);assert.equal(c.provenance.coverage.standings,false);
 const partial=await closingSources('phm',scope,{...options,readOfficialStatistics:async()=>{throw Error('unavailable');}});assert.equal(partial.provenance.coverage.skaters,false);assert.deepEqual(partial.players,[]);
});
test('tool persistence uses organization, namespace and revision together for compare-and-swap',async()=>{
 const calls=[],store=toolStore({tool:'official-closing-preview',sql:{async query(text,values){calls.push({text,values});return [];}}});
 assert.equal(await store.save('EUCHL','final',{versions:[]},5),null);
 assert.match(calls[1].text,/organization=\$2.*slug=\$3.*revision=\$5/s);assert.deepEqual(calls[1].values.slice(0,3),['official-closing-preview','EUCHL','final']);assert.equal(calls[1].values[4],5);
});
test('Closing local routes and Vercel reuse the shared function and serve the editor',async()=>{
 const {server}=await import('../src/server.js'),{readFile}=await import('node:fs/promises');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base='http://127.0.0.1:'+server.address().port;
  for(const path of ['/api/closing?org=unknown','/api/game-summary?view=closing&org=unknown'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/league/closing.js')).status,200);assert.match(await(await fetch(base+'/league/app.js')).text(),/mountClosing/);
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));assert.equal(config.rewrites.find(r=>r.source==='/api/closing').destination,'/api/game-summary?view=closing');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
