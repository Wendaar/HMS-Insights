import test from 'node:test';
import assert from 'node:assert/strict';
import {archivePeriod,readArchivePages,catalogInRange} from '../public/photo-archive/catalog-model.js';
import {timeWindow} from '../src/app/media-engine.js';
import {createArchiveDiscovery} from '../src/app/photo-archive-discovery.js';

test('archive quick periods match Studio/Broadcast date windows, including older and future months',()=>{
  const now=new Date('2026-11-10T12:00:00Z');
  for(const filter of ['Today','Yesterday','-7 days','+7 days','Past','Future'])for(const page of [0,1,3])assert.deepEqual(archivePeriod(filter,now,page),timeWindow(filter,now,page));
});

test('manual October range reads beyond the initial hundred games and keeps continuation scoped to the selected dates',async()=>{
  const calls=[],ids=new Set();let afterOctober=[];
  const read=async q=>{calls.push(q);const games=Math.min(20,246-q.offset);return {...q,games,albums:0,nextOffset:q.offset+games,hasMore:q.offset+games<246,gameIds:Array.from({length:games},(_,i)=>String(q.offset+i))};};
  const result=await readArchivePages({from:'2026-10-01',to:'2026-10-31',read,onPage:p=>p.gameIds.forEach(id=>ids.add(id))});
  assert.equal(calls.length,13);assert.equal(result.count,246);assert.equal(result.hasMore,false);assert.equal(ids.size,246);assert.equal(calls.at(-1).offset,240);
  await readArchivePages({from:'2026-09-01',to:'2026-09-30',read:async q=>{afterOctober.push(q);return {...q,games:0,albums:0,nextOffset:q.offset,hasMore:false};}});
  assert.equal(afterOctober[0].offset,0);
  assert.deepEqual(catalogInRange([{gameId:'old',playedOn:'2026-09-30'},{gameId:'oct',playedOn:'2026-10-05'},{gameId:'nov',playedOn:'2026-11-01'}],{from:'2026-10-01',to:'2026-10-31'},new Set(['oct'])).map(c=>c.gameId),['oct']);
});

test('pause retains the next page and a bad server cursor cannot loop forever',async()=>{
  const page=q=>({...q,games:20,albums:1,nextOffset:q.offset+20,hasMore:true});
  const result=await readArchivePages({from:'2026-10-01',to:'2026-10-31',read:async q=>page(q),stopped:()=>true});assert.equal(result.nextOffset,20);
  await assert.rejects(readArchivePages({from:'2026-10-01',to:'2026-10-31',read:async q=>({...page(q),nextOffset:0})}));
});

test('direct Flickr Album field has priority; explicit empty is distinguished from an omitted API field',async()=>{
  const org='cccccccc-cccc-4ccc-8ccc-cccccccccccc',game='11111111-1111-4111-8111-111111111111';
  const env={HMS_EUCHL_API_TOKEN:'fixture',HMS_EUCHL_ORGANIZATION_ID:org};let value='https://flic.kr/s/aHBqjDakpE',omit=false,rows;
  const discovery=createArchiveDiscovery({env,store:{get:async()=>null,save:async(o,k,d)=>{rows=d.items;return {draft:d};}},fetchImpl:async input=>{
    const u=new URL(input);if(u.hostname==='api.prod.hms.wootera.net')return new Response('',{status:404});
    const row={gameId:game,organizationId:org,startDate:'2026-10-05',HomeTeam:{name:'Home'},AwayTeam:{name:'Away'},...(!omit?{flickrAlbum:value}:{})};
    return Response.json(u.pathname.endsWith('/games')?[row]:u.pathname.endsWith('/teams')?[]:row);
  }});
  await discovery.discover('EUCHL',{from:'2026-10-01',to:'2026-10-31'});assert.equal(rows[0].flickrAlbum,value);assert.equal(rows[0].albumFieldStatus,'link');
  value=null;await discovery.discover('EUCHL',{from:'2026-10-01',to:'2026-10-31'});assert.equal(rows[0].flickrAlbum,null);assert.equal(rows[0].albumFieldStatus,'empty');
  omit=true;await discovery.discover('EUCHL',{from:'2026-10-01',to:'2026-10-31'});assert.equal(rows[0].albumFieldStatus,'unavailable');
});
