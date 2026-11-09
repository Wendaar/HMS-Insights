import test from 'node:test';
import assert from 'node:assert/strict';
import {createTodayPoller,readTodayPages} from '../public/games/live.js';
const clock=()=>{
 let next=0;const tasks=new Map();
 return {tasks,setTimer:(fn,delay)=>{tasks.set(++next,{fn,delay});return next;},clearTimer:id=>tasks.delete(id),fire:async()=>{const [id,task]=tasks.entries().next().value;tasks.delete(id);await task.fn();},delay:()=>tasks.values().next().value?.delay};
};
test('today poller schedules one request per interval, pauses when inactive and resumes immediately',async()=>{
 const timers=clock();let active=true,calls=0;
 const poller=createTodayPoller({...timers,isActive:()=>active,refresh:async()=>calls++});
 poller.sync();poller.sync();assert.equal(timers.tasks.size,1);assert.equal(timers.delay(),30000);assert.equal(calls,0);
 await timers.fire();assert.equal(calls,1);assert.equal(timers.tasks.size,1);assert.equal(timers.delay(),30000);
 active=false;poller.sync();assert.equal(timers.tasks.size,0);
 active=true;poller.sync({immediate:true});assert.equal(timers.delay(),0);await timers.fire();assert.equal(calls,2);
 poller.pause();assert.equal(timers.tasks.size,0);
});
test('slow refreshes never overlap; paused in-flight requests are aborted without showing an outage',async()=>{
 const timers=clock();let signal,release,calls=0,errors=0;
 const poller=createTodayPoller({...timers,isActive:()=>true,onError:()=>errors++,refresh:async s=>{signal=s;calls++;await new Promise(resolve=>release=resolve);}});
 poller.sync();const pending=timers.fire();poller.sync({immediate:true});assert.equal(calls,1);assert.equal(timers.tasks.size,0);
 poller.pause();assert.equal(signal.aborted,true);release();await pending;assert.equal(timers.tasks.size,0);assert.equal(errors,0);
});
test('upstream failures back off, honor bounded Retry-After, and recover to the normal interval',async()=>{
 const timers=clock();let failing=true,errors=0;
 const poller=createTodayPoller({...timers,isActive:()=>true,onError:()=>errors++,refresh:async()=>{if(failing)throw Object.assign(Error('Unavailable'),{retryAfter:90});}});
 poller.sync();await timers.fire();assert.equal(errors,1);assert.equal(timers.delay(),90000);
 failing=false;await timers.fire();assert.equal(timers.delay(),30000);poller.pause();
});
const seasonId='e6134160-47cf-11f1-a223-bfdfbdd3a64b';
test('today refresh preserves all loaded pages and selected search/team filters without sending credentials',async()=>{
 const params=new URLSearchParams({seasonId,filter:'Today',q:'Kosti',teamId:'team',embed:'1'}),calls=[];
 const data=await readTodayPages(params,40,{fetchImpl:async(url,init)=>{
   const q=new URL(url,'https://local.test').searchParams;calls.push(Number(q.get('offset')));assert.equal(q.get('q'),'Kosti');assert.equal(q.get('teamId'),'team');assert.equal(q.get('filter'),'Today');assert.equal(init.headers.authorization,undefined);assert.equal(init.cache,'no-store');
   const offset=Number(q.get('offset'));return new Response(JSON.stringify({seasonId,filter:'Today',offset,limit:20,total:45,hasMore:true,items:Array.from({length:20},(_,i)=>({id:String(offset+i)}))}));
 }});
 assert.deepEqual(calls,[0,20]);assert.equal(data.items.length,40);assert.equal(data.nextOffset,40);assert.equal(data.hasMore,true);
});
test('a failed later page or wrong scope never produces a partially refreshed live result',async()=>{
 let calls=0;await assert.rejects(readTodayPages(new URLSearchParams({seasonId}),40,{fetchImpl:async()=>++calls===1?new Response(JSON.stringify({seasonId,filter:'Today',offset:0,limit:20,total:40,hasMore:true,items:Array.from({length:20},(_,i)=>({id:String(i)}))})):new Response('',{status:429,headers:{'retry-after':'60'}})}),error=>error.status===429&&error.retryAfter==='60');
 await assert.rejects(readTodayPages(new URLSearchParams({seasonId}),20,{fetchImpl:async()=>new Response(JSON.stringify({seasonId:'foreign',filter:'Today',offset:0,limit:20,items:[]}))}));
});
