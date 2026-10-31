import test from 'node:test';
import assert from 'node:assert/strict';
import {mapForOrganization,nodeUrl,readContext,writeContext} from '../public/control/map.js';
const id='F6321894-98CA-11F1-8BDF-EF2495D048F3';
const nodes=org=>mapForOrganization(org).flatMap(b=>b.nodes);
test('planned organizations and unimplemented sponsor outputs never acquire launch URLs from PHM',()=>{
  for(const org of ['yhg','fllh','unknown'])for(const n of nodes(org)){
    assert.equal(n.status,'Planned');assert.equal(nodeUrl(n,org,{gameId:id,seasonId:id}),null);
  }
  for(const n of nodes('phm').filter(n=>['sponsor-broadcast','sponsor-output'].includes(n.id))){assert.equal(n.status,'Planned');assert.equal(nodeUrl(n,'phm',{gameId:id}),null);}
});
test('launchers require valid context and forward only supported destination parameters',()=>{
  const find=(org,id)=>nodes(org).find(n=>n.id===id);
  assert.equal(nodeUrl(find('phm','game-report'),'phm'),null);
  assert.equal(nodeUrl(find('phm','games-view'),'phm',{seasonId:'bad'}),null);
  assert.equal(nodeUrl(find('phm','game-report'),'phm',{gameId:id}),'https://app.phmcup.cz/game-center/'+id);
  const schedule=new URL(nodeUrl(find('euchl','games-view'),'euchl',{seasonId:id}),'https://hms.test');assert.equal(schedule.searchParams.get('seasonId'),id);
  const obs=new URL(nodeUrl(find('euchl','obs-output'),'euchl',{gameId:id}),'https://hms.test');
  assert.equal(obs.searchParams.get('org'),'EUCHL');assert.equal(obs.searchParams.get('game'),id);assert.equal(obs.searchParams.get('mode'),'overlay');
  assert.equal(nodeUrl(find('phm','all-stars'),'phm',{gameId:id,seasonId:id}),'/control/apps/all-stars?org=phm');
  assert.equal(nodeUrl(find('phm','social-output'),'phm'),'/studio/phm?lang=cs');
});
test('local context is organization scoped, durable and resilient to invalid browser storage',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  writeContext(storage,'phm',{leagues:[{name:'PHM 2026',seasonId:id}],gameId:id,work:'broadcast'});
  assert.equal(readContext(storage,'phm').gameId,id);assert.deepEqual(readContext(storage,'euchl'),{});
  writeContext(storage,'euchl',{leagues:[{name:'EUCHL',seasonId:id}],work:'social'});
  assert.equal(readContext(storage,'phm').work,'broadcast');assert.equal(readContext(storage,'euchl').work,'social');
  values.set('hms-map-v2:phm','{bad');assert.deepEqual(readContext(storage,'phm'),{});
  values.set('hms-map-v2:phm',JSON.stringify({leagues:'bad',gameId:'<bad>',work:'bad'}));assert.deepEqual(readContext(storage,'phm').leagues,[]);assert.equal(readContext(storage,'phm').gameId,'');
  assert.equal(writeContext({setItem(){throw Error();}},'phm',{}),false);
});

test('shared sponsor catalog remains explicitly Beta with separate organization links',()=>{const phm=nodes('phm').find(n=>n.id==='sponsor-definition'),euchl=nodes('euchl').find(n=>n.id==='sponsor-definition');assert.equal(phm.status,'Beta');assert.match(nodeUrl(phm,'phm'),/org=PHM/);assert.match(nodeUrl(euchl,'euchl'),/org=EUCHL/);});

test('Game Show launches preparation and operator panel with organization and optional match context',()=>{
  for(const org of ['phm','euchl']){
    const setup=nodes(org).find(n=>n.id==='gameshow-definition'),panel=nodes(org).find(n=>n.id==='gameshow-control');
    assert.equal(setup.status,'Beta');assert.equal(panel.status,'Beta');
    assert.equal(nodeUrl(setup,org),'/media-mapping?org='+org.toUpperCase());
    assert.equal(nodeUrl(panel,org),'/show-control?org='+org.toUpperCase());
    const url=new URL(nodeUrl(panel,org,{gameId:id}),'https://public.heromanagementsystem.com');
    assert.equal(url.searchParams.get('org'),org.toUpperCase());assert.equal(url.searchParams.get('gameId'),id);
    assert.equal(nodeUrl(panel,org,{gameId:'bad'}),nodeUrl(panel,org));
  }
});
