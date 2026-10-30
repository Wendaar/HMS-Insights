import test from 'node:test';
import assert from 'node:assert/strict';
import {allDayFixtures,shiftCalendarDate} from '../public/studio/game-day-data.js';
const org='PHM',date='2026-10-30';
const fixture=i=>({org,date,gameId:String(i),venue:i<20?'Praha':'Brno'});

test('whole-day assembly includes later pages before venue filtering',async()=>{
 const calls=[],result=await allDayFixtures(async offset=>{calls.push(offset);return{items:Array.from({length:offset===0?20:4},(_,i)=>fixture(offset+i)),hasMore:offset===0,source:'HMS'};},{org,date});
 assert.deepEqual(calls,[0,20]);assert.equal(result.items.length,24);assert.equal(result.items.filter(p=>p.venue==='Brno').length,4);
});
test('whole-day export rejects duplicate, foreign and mixed-source pages instead of presenting partial schedules',async()=>{
 for(const second of [{...fixture(20),gameId:'0'},{...fixture(20),org:'EUCHL'},{...fixture(20),date:'2026-10-31'}]){
  await assert.rejects(allDayFixtures(async offset=>({items:offset?[second]:Array.from({length:20},(_,i)=>fixture(i)),hasMore:!offset,source:'HMS'}),{org,date}));
 }
 await assert.rejects(allDayFixtures(async offset=>({items:[fixture(offset)],hasMore:!offset,source:offset?'imported-snapshot':'HMS'}),{org,date}));
});
test('more than 100 games and non-advancing or oversized pages fail before exposing an incomplete result',async()=>{
 let calls=0;await assert.rejects(allDayFixtures(async offset=>{calls++;return{items:Array.from({length:20},(_,i)=>fixture(offset+i)),hasMore:true,source:'HMS'};},{org,date}),/100/);assert.equal(calls,6);
 const exact=await allDayFixtures(async offset=>({items:offset===100?[]:Array.from({length:20},(_,i)=>fixture(offset+i)),hasMore:offset!==100,source:'HMS'}),{org,date});assert.equal(exact.items.length,100);
 await assert.rejects(allDayFixtures(async()=>({items:[],hasMore:true,source:'HMS'}),{org,date}),/advance/);
 await assert.rejects(allDayFixtures(async()=>({items:Array.from({length:21},(_,i)=>fixture(i)),hasMore:false}),{org,date}),/Invalid/);
});
test('aborted loads cannot return stale fixtures after a date or organization switch',async()=>{
 const controller=new AbortController();
 await assert.rejects(allDayFixtures(async()=>{controller.abort();return{items:[fixture(0)],hasMore:false,source:'HMS'};},{org,date,signal:controller.signal}),e=>e.name==='AbortError');
});
test('calendar navigation preserves Prague dates across DST and year boundaries',()=>{
 assert.equal(shiftCalendarDate('2026-10-25',1),'2026-10-26');assert.equal(shiftCalendarDate('2026-03-29',-1),'2026-03-28');assert.equal(shiftCalendarDate('2026-12-31',1),'2027-01-01');assert.throws(()=>shiftCalendarDate('2026-02-30',1));
});
