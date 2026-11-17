import test from 'node:test';
import assert from 'node:assert/strict';
import {portalCatalog,validatePortalSeasons} from '../src/app/public-portal.js';
import {fetchCompetitions} from '../src/hms/client.js';
import {loadPortalHmsCatalog} from '../src/app/portal-hms-catalog.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const options=()=>({env:{HMS_YHG_ORGANIZATION_ID:id(1)},loadPortalSeasons:async()=>[],fetchOrganization:async()=>({organizationId:id(1),name:'Yellow Hockey Games'}),fetchCompetitions:async()=>[{competitionId:id(2),name:'Prague',Seasons:[{seasonId:id(3),name:'2026'}]}]});

test('new HMS tournament is selectable and valid for publication without an imported game',async()=>{
 const opts=options(),catalog=await portalCatalog('YHG',opts);
 assert.equal(catalog.source,'hms-and-imported-seasons');
 assert.equal(catalog.items[0].competition,'Prague');
 assert.equal(catalog.items[0].sampleGameId,null);
 assert.equal((await validatePortalSeasons('YHG',{seasonIds:[id(3)],widgets:[]},opts))[0].seasonId,id(3));
 await assert.rejects(validatePortalSeasons('YHG',{seasonIds:[id(9)],widgets:[]},opts),/foreign season/);
});

test('HMS catalog rejects token identity, foreign nested rows and ambiguous seasons',async()=>{
 await assert.rejects(portalCatalog('YHG',{...options(),fetchOrganization:async()=>({organizationId:id(9)})}),/organization mismatch/);
 for(const patch of [{organizationId:id(9)},{Seasons:[{seasonId:id(3),name:'Other',competitionId:id(9)}]},{Seasons:[{seasonId:id(3),name:'A'},{seasonId:id(3),name:'B'}]}]){
  await assert.rejects(portalCatalog('YHG',{...options(),fetchCompetitions:async()=>[{competitionId:id(2),name:'Prague',Seasons:[],...patch}]}),/ownership|ambiguous/);
 }
});

test('HMS outage preserves imported history, malformed successful responses fail closed',async()=>{
 const opts={...options(),loadPortalSeasons:async()=>[{organization_id:id(1),competition_id:id(2),competition_name:'Prague',season_id:id(3),season_name:'2026',sample_game_id:id(4)}]};
 const catalog=await portalCatalog('YHG',{...opts,fetchCompetitions:async()=>{throw Error('offline');}});
 assert.equal(catalog.source,'imported-hms-seasons');assert.equal(catalog.items[0].sampleGameId,id(4));
 const refreshed=await portalCatalog('YHG',opts);assert.equal(refreshed.items.length,1);assert.equal(refreshed.items[0].sampleGameId,id(4));
 await assert.rejects(portalCatalog('YHG',{...opts,fetchCompetitions:async()=>({unknown:[]})}),/shape/);
});

test('competitions request uses documented server integration endpoint without game filters',async()=>{
 await fetchCompetitions({config:{token:'test-only',baseUrl:'https://example.test/api/v1'},fetchImpl:async(url,init)=>{
  assert.equal(String(url),'https://example.test/api/v1/competitions');
  assert.equal(init.headers.authorization,'Bearer test-only');return {ok:true,json:async()=>[]};
 }});
});

test('concurrent and repeated catalog reads share requests while organizations stay separate',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init)=>{
  const token=init.headers.authorization,c=token.endsWith('org-a')?21:22;calls.push({path:new URL(url).pathname,token});
  await new Promise(resolve=>setTimeout(resolve,5));
  return {ok:true,json:async()=>String(url).endsWith('/organization')?{organizationId:id(c)}:[{competitionId:id(c+10),name:'Tournament',Seasons:[{seasonId:id(c+20),name:'2026'}]}]};
 };
 try{
  const a={code:'TEST_A',id:id(21),token:'org-a'},b={code:'TEST_B',id:id(22),token:'org-b'};
  const results=await Promise.all(Array.from({length:8},()=>loadPortalHmsCatalog(a)));
  assert.equal(calls.length,2);assert.ok(results.every(r=>r[0].seasonId===id(41)));
  await loadPortalHmsCatalog(a);assert.equal(calls.length,2);
  assert.equal((await loadPortalHmsCatalog(b))[0].seasonId,id(42));assert.equal(calls.length,4);
 }finally{globalThis.fetch=original;}
});
