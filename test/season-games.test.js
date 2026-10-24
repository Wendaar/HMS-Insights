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
