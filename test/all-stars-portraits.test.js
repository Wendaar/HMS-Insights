import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAllStarsPortraits} from '../src/app/all-stars-portraits.js';
import {readPlayerPortraits} from '../src/app/broadcast-league.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const host='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com';
const fixture={group:{id:id(1)},home:{id:id(2)},away:{id:id(3)}};
const player={id:id(4)+'|'+id(2),imageUrl:host+'/old',points:7,gp:4};
const data=()=>({candidates:{F:[{...player}],D:[{...player}],G:[{...player}]}});
test('refresh replaces historical portraits only, matches player and team, and retains monthly statistics',async()=>{
  const result=data(),calls=[];
  const meta=await refreshAllStarsPortraits(result,[fixture],{groupId:id(1)},{readPlayerPortraits:async group=>{
    calls.push(group);return {players:[{PlayerId:id(4).toUpperCase(),TeamId:id(2),PlayerLogo:host+'/new_[size]',P:900,GP:80},{PlayerId:id(4),TeamId:id(90),PlayerLogo:host+'/foreign'}],goalies:[{PlayerId:id(4),TeamId:id(2),PlayerLogo:host+'/keeper'}]};
  }});
  assert.deepEqual(calls,[id(1)]);assert.equal(meta.complete,true);
  for(const role of ['F','D'])assert.deepEqual(result.candidates[role][0],{...player,imageUrl:host+'/new_cropped_md'});
  assert.equal(result.candidates.G[0].imageUrl,host+'/keeper');
});
test('portrait outages, missing/unsafe photos and ambiguous rows retain imported photos',async()=>{
  for(const rows of [null,[],[null],[{PlayerId:id(4),TeamId:id(2),PlayerLogo:'https://evil.example/photo'}],[{PlayerId:id(4),TeamId:id(2),PlayerLogo:host+'/a'},{PlayerId:id(4),TeamId:id(2),PlayerLogo:host+'/b'}]]){
    const result=data();await refreshAllStarsPortraits(result,[fixture],{groupId:id(1)},{readPlayerPortraits:async()=>({players:rows,goalies:rows})});assert.deepEqual(result,data());
  }
  const result=data(),meta=await refreshAllStarsPortraits(result,[fixture],{},{readPlayerPortraits:async()=>{throw Error('private');}});assert.equal(meta.complete,false);assert.deepEqual(result,data());
  let calls=0;await refreshAllStarsPortraits(data(),[fixture],{groupId:id(99)},{readPlayerPortraits:async()=>{calls++;}});assert.equal(calls,0);
});
test('current public portrait transport uses bounded fixed-host group queries without credentials or cache',async()=>{
  const calls=[];const value=await readPlayerPortraits(id(1),{fetchImpl:async(url,options)=>{calls.push({url:new URL(url),options});return new Response(JSON.stringify([{PlayerLogo:host+'/current'}]));}});
  assert.equal(value.players.length,1);assert.equal(value.goalies.length,1);assert.equal(calls.length,2);
  for(const {url,options}of calls){assert.equal(url.origin,'https://api.prod.hms.wootera.net');assert.equal(url.searchParams.get('groupId'),id(1));assert.equal(options.headers.authorization,undefined);assert.equal(options.cache,'no-store');}
  await assert.rejects(readPlayerPortraits('bad'),TypeError);
});
