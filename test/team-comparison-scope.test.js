import test from 'node:test';
import assert from 'node:assert/strict';
import {publicComparisonCatalog,comparisonCatalog,readTeamComparison} from '../src/app/team-comparison.js';
import {controlContextCatalog} from '../src/app/control-context.js';
import {createTeamComparisonHandler} from '../src/web/team-comparison-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_PHM_ORGANIZATION_ID:id(1)},items=[{competitionId:id(10),seasonId:id(2),name:'Cup · 2026–2027'},{competitionId:id(10),seasonId:id(5),name:'Cup · 2025–2026'},{competitionId:id(20),seasonId:id(6),name:'Other · 2026–2027'}];
const options={env,catalog:async()=>({org:'PHM',items}),loadScope:async(config,seasonId)=>seasonId===id(5)?[]:[{organization_id:id(1),season_id:seasonId,group_id:id(3),group_name:'Division',phase_id:id(4),phase_name:'Regular'}]};
const q={competitionId:id(10),seasonId:id(2),lockSeason:'1',groupId:id(3),phaseId:id(4)};
async function call(query,opts=options){const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};await createTeamComparisonHandler(opts)({method:'GET',query:{org:'phm',...query}},res);return res;}
test('catalog scopes competition and locked season while legacy season remains a preselection',async()=>{
 assert.equal((await publicComparisonCatalog('phm',{},options)).items.length,3);
 assert.equal((await publicComparisonCatalog('phm',{seasonId:id(2),embed:'1'},options)).items.length,3);
 assert.deepEqual((await publicComparisonCatalog('phm',{competitionId:id(10)},options)).items.map(s=>s.seasonId),[id(2),id(5)]);
 assert.deepEqual((await publicComparisonCatalog('phm',q,options)).items.map(s=>s.seasonId),[id(2)]);
 assert.equal((await call({action:'catalog',...q})).code,200);
});
test('all API actions fail closed for malformed, foreign, conflicting and incomplete constraints',async()=>{
 const invalid=[{competitionId:'oops'},{seasonId:'oops'},{competitionId:id(99)},{seasonId:id(99)},{competitionId:id(20)},{seasonId:id(6)},{seasonId:undefined},{groupId:id(99)},{phaseId:id(99)},{lockSeason:'true'}];
 for(const action of ['catalog','scope','compare'])for(const change of invalid){const input={...q,...change};if(input.seasonId===undefined)delete input.seasonId;const r=await call({action,...input});assert.equal(r.code,400,JSON.stringify({action,input,result:r.body}));assert.match(r.body.error,/rozsah/);}
});
test('valid empty season and upstream failure never select another season',async()=>{
 const input={competitionId:id(10),seasonId:id(5),lockSeason:'1'};
 const result=await comparisonCatalog('phm',input,options);assert.equal(result.season.seasonId,id(5));assert.deepEqual(result.groups,[]);
 const r=await call({action:'scope',...input},{...options,catalog:async()=>{throw Error('HMS down');}});assert.equal(r.code,503);assert.equal(r.body.season,undefined);
});
test('cache validates restrictions and team selections on warm hits and isolates scoped entries',async()=>{
 let reads=0;const opts={...options,sql:{query:async()=>[]},fetchImpl:async url=>{reads++;return {ok:true,json:async()=>String(url).includes('standings')?[{TeamId:id(30),'Team Name':'Test','Total Games':0,'Total Points':0,Wins:0,Draws:0,Losses:0,Score:'0:0'}]:[]};}};
 const legacy={seasonId:id(2),groupId:id(3),phaseId:id(4)};
 await readTeamComparison('phm',legacy,opts);const first=reads;assert.ok(first>0);
 await readTeamComparison('phm',legacy,opts);assert.equal(reads,first);
 await readTeamComparison('phm',q,opts);assert.ok(reads>first);const warm=reads;
 await readTeamComparison('phm',{...q,left:id(30)},opts);assert.equal(reads,warm);
 for(const change of [{competitionId:id(20)},{competitionId:'bad'},{seasonId:id(6)},{left:id(99)},{right:id(99)}])await assert.rejects(()=>readTeamComparison('phm',{...q,...change},opts),TypeError);
 assert.equal(reads,warm);
});
test('shared Studio catalog retains verified competition IDs from imports and live empty seasons',async()=>{
 const result=await controlContextCatalog('phm',{env,loadLeagues:async()=>[{organization_id:id(1),competition_id:id(10),season_id:id(2),competition_name:'Cup',season_name:'2026–2027'}],fetchOrganization:async()=>({organizationId:id(1)}),fetchCompetitions:async()=>[{competitionId:id(20),name:'Other',Seasons:[{seasonId:id(6),name:'2026–2027',Groups:[]}]}]});
 assert.equal(result.items.length,2);assert.equal(result.items.find(s=>s.seasonId===id(2)).competitionId,id(10));assert.equal(result.items.find(s=>s.seasonId===id(6)).competitionId,id(20));
});


test('live HMS scope verifies child IDs before returning an empty directory',async()=>{
 const live={...options,fetchOrganization:async()=>({organizationId:id(1)}),fetchCompetitions:async()=>[{competitionId:id(10),name:'Cup',Seasons:[{seasonId:id(2),name:'2026–2027',Groups:[{groupId:id(3),name:'Division',Phases:[{phaseId:id(4),name:'Regular'}]}]}]}],readDirectoryTeams:async()=>[]};
 assert.equal((await comparisonCatalog('phm',q,live)).groups[0].id,id(3));
 for(const change of [{groupId:id(99)},{phaseId:id(99)}])await assert.rejects(()=>comparisonCatalog('phm',{...q,...change},live),TypeError);
});
