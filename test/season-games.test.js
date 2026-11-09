import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonGamesQuery,publicSeasonGame,seasonGamePage,officialNames,calendarDate} from '../src/domain/season-games.js';
import {browseSeasonGames,ScheduleSourceError} from '../src/app/season-games.js';
import {createSeasonGamesHandler} from '../src/web/season-games-handler.js';
import {loadAvailableGameReports} from '../src/infrastructure/postgres-repository.js';
import {buildGameSummary} from '../src/domain/game-summary.js';
import {renderGameReport} from '../src/web/game-report.js';
const seasonId='4b913940-c4fb-11f1-8ad4-9967cdc84598',uuid=n=>`${n.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`,now=new Date('2026-10-24T12:00:00Z');
const fixture=(n=1,date='2026-10-24')=>({gameId:uuid(n),startDate:date,startTime:'19:00:00',status:'FINISHED',name:'Match note',HomeTeamGoals:2,AwayTeamGoals:8,HomeTeam:{teamId:uuid(101),name:'Prague Guardians',logoUrl:'https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/team_[size]'},AwayTeam:{teamId:uuid(102),name:'Bratislava Capitals'},Venue:{name:'ICERINK'},referee:[{firstName:'Jane',lastName:'Ref',email:'SECRET'},'John Ref'],timekeeper:'Timer',Phase:{phaseId:uuid(201),name:'Regular phase',Group:{groupId:uuid(301),name:'Division One',Season:{seasonId,name:'2026-2027',Competition:{name:'European Union College Hockey League'}}}},private:'SECRET'});
const options=(rows=[])=>({now,loadReports:async()=>[],fetchImpl:async(url,init)=>{const u=new URL(url);assert.equal(u.hostname,'api.prod.hms.wootera.net');assert.equal(init.headers.authorization,undefined);return {ok:true,json:async()=>u.pathname.endsWith('/seasonTerms')?{name:'2026-2027',Competition:{name:'European Union College Hockey League'},terms:'SECRET'}:rows.filter(r=>r.startDate===u.searchParams.get('startDate'))};}});
test('date windows use Prague calendar days through DST and never span over seven days',()=>{
  for(const filter of ['Today','Yesterday','+7 days','-7 days','Past','Future'])assert.ok(seasonGamesQuery({seasonId,filter},now).dates.length<=7);
  assert.equal(seasonGamesQuery({seasonId},new Date('2026-10-24T23:30:00Z')).from,'2026-10-25');
  assert.deepEqual(seasonGamesQuery({seasonId,filter:'Past',windowPage:'1'},now).dates,['2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']);
  assert.equal(seasonGamesQuery({seasonId,filter:'Future',windowPage:'1'},now).to,'2026-11-07');
  assert.equal(calendarDate('2026-02-30'),false);assert.equal(calendarDate('2028-02-29'),true);
});
test('invalid scope, date, filters and oversized pagination are rejected before reading upstream',async()=>{
  for(const query of [{seasonId:'bad'},{seasonId,filter:'All'},{seasonId,offset:1},{seasonId,offset:100001},{seasonId,windowPage:521},{seasonId,filter:'Date',date:'2026-02-30'},{seasonId,teamId:'bad'},{seasonId,q:[]}])await assert.rejects(browseSeasonGames(query,{...options(),fetchImpl:async()=>assert.fail()}),TypeError);
});
test('public model includes optional sporting fields and multiple officials without private data',()=>{
  const model=publicSeasonGame(fixture(),seasonId,'2026-10-24');
  assert.equal(model.referee,'Jane Ref, John Ref');assert.equal(model.timekeeper,'Timer');assert.equal(model.name,'Match note');
  assert.match(model.home.logoUrl,/cropped_md$/);assert.doesNotMatch(JSON.stringify(model),/SECRET|email|private/);
  assert.equal(officialNames([{firstName:'A',lastName:'B',phone:'SECRET'},'A B']),'A B');
  assert.throws(()=>publicSeasonGame(fixture(),uuid(9),'2026-10-24'));
  assert.throws(()=>publicSeasonGame(fixture(),seasonId,'2026-10-23'));
});
test('scheduled default zeroes stay unknown; final and live zeroes are real scores; unknown teams remain empty',()=>{
  const source=fixture();source.status='NOT PLAYED';source.HomeTeamGoals=0;source.AwayTeamGoals=0;source.HomeTeam=null;
  const future=publicSeasonGame(source,seasonId,source.startDate);assert.equal(future.home.score,null);assert.equal(future.away.score,null);assert.equal(future.home.name,null);
  source.status='LIVE';assert.equal(publicSeasonGame(source,seasonId,source.startDate).home.score,0);
  source.status='FINISHED';assert.equal(publicSeasonGame(source,seasonId,source.startDate).away.score,0);
});
test('pagination is bounded, deterministic and filters before slicing',()=>{
  const rows=Array.from({length:45},(_,i)=>publicSeasonGame(fixture(i+1),seasonId,'2026-10-24')),query=seasonGamesQuery({seasonId,offset:20,q:'prague'},now);
  const page=seasonGamePage(rows,query);assert.equal(page.items.length,20);assert.equal(page.total,45);assert.equal(page.hasMore,true);assert.equal(page.items[0].id,uuid(21));
  assert.equal(seasonGamePage(rows,{...query,teamId:uuid(999)}).total,0);
  assert.equal(seasonGamePage([...rows,rows[0]],query).total,45);
});
test('browser reads only selected days with at most three concurrent day requests and one batch of report IDs',async()=>{
  let active=0,max=0,dayCalls=0,batch;
  const rows=Array.from({length:25},(_,i)=>fixture(i+1,'2026-10-23'));
  const stub=options(rows),data=await browseSeasonGames({seasonId,filter:'-7 days'},{...stub,loadReports:async(ids,scope)=>{batch=ids;assert.equal(scope,seasonId);return [ids[0]];},fetchImpl:async(url,init)=>{
    if(new URL(url).pathname.endsWith('/games')){active++;max=Math.max(max,active);dayCalls++;await new Promise(resolve=>setImmediate(resolve));active--;}
    return stub.fetchImpl(url,init);
  }});
  assert.equal(dayCalls,7);assert.ok(max<=3);assert.equal(batch.length,20);assert.equal(data.items.length,20);assert.equal(data.items[0].reportAvailable,true);assert.equal(data.items[1].reportAvailable,false);assert.equal(data.total,25);
  assert.doesNotMatch(JSON.stringify(data),/SECRET|terms|email/);
});
test('empty day still exposes safe season labels and source failures never masquerade as an empty schedule',async()=>{
  const data=await browseSeasonGames({seasonId},options());assert.equal(data.total,0);assert.equal(data.season,'2026-2027');assert.match(data.competition,/College Hockey/);
  await assert.rejects(browseSeasonGames({seasonId},{...options(),fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'45'})})}),error=>error instanceof ScheduleSourceError&&error.retryAfter===45);
});
test('availability SQL is parameterized and season-scoped; handler is read-only and sanitizes failures',async()=>{
  let bound;await loadAvailableGameReports([uuid(1)],seasonId,{sql:{query:async(sql,args)=>{bound={sql,args};return [];}}});
  assert.match(bound.sql,/season_id=\$1::uuid/);assert.deepEqual(bound.args,[seasonId,[uuid(1)]]);
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;}});
  const res=response();await createSeasonGamesHandler({browse:async()=>assert.fail()})({method:'POST'},res);assert.equal(res.code,405);
  const failed=response();await createSeasonGamesHandler({browse:async()=>{throw new TypeError('SECRET');}})({method:'GET'},failed);assert.equal(failed.code,503);assert.doesNotMatch(JSON.stringify(failed.body),/SECRET/);
  const rate=response();await createSeasonGamesHandler({browse:async()=>{throw new ScheduleSourceError(429,60);}})({method:'GET'},rate);assert.equal(rate.code,429);assert.equal(rate.headers['retry-after'],'60');
});
test('Game Report links back to its own season and selected language',()=>{
  const source=fixture(),summary=buildGameSummary({game:{game_id:source.gameId,season_id:seasonId,home_team_id:source.HomeTeam.teamId,away_team_id:source.AwayTeam.teamId,home_team_name:source.HomeTeam.name,away_team_name:source.AwayTeam.name,home_score:2,away_score:8,status:'FINISHED'}});
  assert.equal(summary.seasonId,seasonId);
  assert.match(renderGameReport(summary,{lang:'en'}),new RegExp('/game-center\\?seasonId='+seasonId+'&amp;lang=en">Games</a>'));
});

test('Future searches the entire remaining season, including distant weeks and accented officials',async()=>{
  const rows=[fixture(1,'2026-10-25'),fixture(2,'2027-03-07'),fixture(3,'2027-04-06'),fixture(4,'2026-10-01'),fixture(5,'2026-10-24')];
  rows[1].AwayTeam.name='HC Kosti';rows[2].referee='Christína Marinettí';
  let calls=0;
  const opt={now,loadReports:async()=>[],fetchImpl:async url=>{const u=new URL(url);return {ok:true,json:async()=>u.pathname.endsWith('/seasonTerms')?{}:(calls++,assert.equal(u.searchParams.has('startDate'),false),rows)};}};
  const future=await browseSeasonGames({seasonId,filter:'Future',q:'Kosti'},opt);
  assert.equal(calls,1);assert.equal(future.scope,'season');assert.equal(future.total,1);assert.equal(future.items[0].date,'2027-03-07');
  const staff=await browseSeasonGames({seasonId,filter:'Future',q:'Christina'},opt);assert.equal(staff.total,1);assert.equal(staff.items[0].date,'2027-04-06');
  const all=await browseSeasonGames({seasonId,filter:'Future',windowPage:17},opt);assert.equal(all.total,3);assert.equal(all.windowPage,0);
  assert.doesNotMatch(JSON.stringify(all),/SECRET|private|email/);
});
test('whole-season pages filter and order before slicing, and reports are loaded only for the displayed batch',async()=>{
  const rows=Array.from({length:45},(_,i)=>fixture(i+1,i%2?'2027-01-12':'2027-04-06'));
  const batches=[],opt={now,loadReports:async ids=>{batches.push(ids);return [ids[0]];},fetchImpl:async url=>({ok:true,json:async()=>new URL(url).pathname.endsWith('/seasonTerms')?{}:rows})};
  const first=await browseSeasonGames({seasonId,filter:'Future'},opt),second=await browseSeasonGames({seasonId,filter:'Future',offset:20},opt),third=await browseSeasonGames({seasonId,filter:'Future',offset:40},opt);
  assert.deepEqual([first.items.length,second.items.length,third.items.length],[20,20,5]);assert.equal(third.hasMore,false);
  assert.equal(new Set([...first.items,...second.items,...third.items].map(g=>g.id)).size,45);assert.equal(first.items[0].date,'2027-01-12');
  assert.deepEqual(batches.map(b=>b.length),[20,20,5]);assert.equal(first.items[0].reportAvailable,true);
  rows[0].startDate='2026-01-01';rows[1].startDate='2026-10-22';
  const past=await browseSeasonGames({seasonId,filter:'Past'},opt);assert.equal(past.total,2);assert.equal(past.items[0].date,'2026-10-22');
});
test('season index rejects foreign seasons, impossible dates, overlarge payloads and source failures',async()=>{
  const run=rows=>browseSeasonGames({seasonId,filter:'Future'},{now,fetchImpl:async url=>({ok:true,json:async()=>new URL(url).pathname.endsWith('/seasonTerms')?{}:rows})});
  const foreign=fixture(1,'2027-01-01');foreign.Phase.Group.Season.seasonId=uuid(9);
  await assert.rejects(run([foreign]));await assert.rejects(run([fixture(1,'2027-02-30')]));await assert.rejects(run(Array.from({length:20001},()=>fixture())));
  await assert.rejects(browseSeasonGames({seasonId,filter:'Future'},{now,fetchImpl:async()=>({ok:true,headers:new Headers({'content-length':String(17*1024*1024)}),json:async()=>[]})}),ScheduleSourceError);
  await assert.rejects(browseSeasonGames({seasonId,filter:'Future'},{now,fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'12'})})}),e=>e instanceof ScheduleSourceError&&e.status===429);
});
test('parallel browsing reuses one public season index and later searches do not reload HMS',async()=>{
  const scoped=uuid(909),row=fixture(1,'2027-01-01');row.Phase.Group.Season.seasonId=scoped;
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/seasonTerms'))return new Response(JSON.stringify({}));calls++;await new Promise(resolve=>setImmediate(resolve));return new Response(JSON.stringify([row]));};
  try{
    const opt={now,env:{}},queries=[{seasonId:scoped,filter:'Future'},{seasonId:scoped,filter:'Future',q:'Prague'}];
    const pages=await Promise.all(queries.map(q=>browseSeasonGames(q,opt)));assert.equal(pages[0].total,1);assert.equal(pages[1].total,1);assert.equal(calls,1);
    await browseSeasonGames({seasonId:scoped,filter:'Future',q:'Bratislava'},opt);assert.equal(calls,1);
  }finally{globalThis.fetch=previous;}
});

test('schedule embeds allow the two league websites without opening private tools to framing',async()=>{
  const {readFile}=await import('node:fs/promises'),hosting=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
  for(const entry of hosting.headers.filter(h=>['/game-center','/games/:path*'].includes(h.source))){
    const csp=entry.headers.find(h=>h.key==='Content-Security-Policy').value;
    for(const host of ['https://phmcup.cz','https://www.phmcup.cz','https://bnhlh.cz','https://www.bnhlh.cz'])assert.ok(csp.includes(host));
    assert.doesNotMatch(csp,/frame-ancestors \*/);assert.match(csp,/script-src 'self'/);
  }
  for(const entry of hosting.headers.filter(h=>['/operations/:path*','/registrations/:path*'].includes(h.source)))assert.match(entry.headers.find(h=>h.key==='Content-Security-Policy').value,/frame-ancestors 'none'/);
});

test('RUNNING is the real HMS live state, including a genuine 0:0; scheduled zeroes remain unknown',()=>{
  const source=fixture();source.status='RUNNING';source.HomeTeamGoals=3;source.AwayTeamGoals=3;
  let live=publicSeasonGame(source,seasonId,source.startDate);assert.equal(live.live,true);assert.equal(live.home.score,3);assert.equal(live.away.score,3);
  source.HomeTeamGoals=0;source.AwayTeamGoals=0;live=publicSeasonGame(source,seasonId,source.startDate);assert.equal(live.live,true);assert.equal(live.home.score,0);assert.equal(live.away.score,0);
  source.status='NOT PLAYED';assert.equal(publicSeasonGame(source,seasonId,source.startDate).home.score,null);
  source.status='FINISHED';assert.equal(publicSeasonGame(source,seasonId,source.startDate).live,false);
  source.status='RUNNING';source.HomeTeamGoals=null;assert.equal(publicSeasonGame(source,seasonId,source.startDate).home.score,null);
});
test('Today never inherits the 60-second day cache and concurrent live requests share one HMS read',async()=>{
  const scoped=uuid(919),row=fixture(1);row.Phase.Group.Season.seasonId=scoped;row.status='RUNNING';
  const originalFetch=globalThis.fetch,originalNow=Date.now;let time=originalNow(),calls=0;
  Date.now=()=>time;
  globalThis.fetch=async url=>new URL(url).pathname.endsWith('/seasonTerms')?new Response('{}'):(calls++,await new Promise(resolve=>setImmediate(resolve)),new Response(JSON.stringify([row])));
  try{
    const opt={now,env:{}};
    await browseSeasonGames({seasonId:scoped,filter:'Date',date:row.startDate},opt);assert.equal(calls,1);
    time+=16000;row.HomeTeamGoals=4;
    const pages=await Promise.all([1,2].map(()=>browseSeasonGames({seasonId:scoped,filter:'Today'},opt)));
    assert.equal(calls,2);assert.equal(pages[0].items[0].home.score,4);
    time+=14000;await browseSeasonGames({seasonId:scoped,filter:'Today'},opt);assert.equal(calls,2);
    time+=2000;row.HomeTeamGoals=5;const latest=await browseSeasonGames({seasonId:scoped,filter:'Today'},opt);assert.equal(calls,3);assert.equal(latest.items[0].home.score,5);
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
test('Today bypasses HTTP/CDN caching; other calendar views keep their existing shared cache',async()=>{
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(data){this.data=data;}});
 for(const filter of ['Today','Future','Past']){const res=response();await createSeasonGamesHandler({browse:async()=>({filter})})({method:'GET'},res);assert.equal(res.headers['cache-control'],filter==='Today'?'no-store':'public, s-maxage=30, stale-while-revalidate=30');}
});
