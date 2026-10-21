import test from 'node:test';
import assert from 'node:assert/strict';
import {timeWindow,organizationConfig,browseMedia,mediaGame} from '../src/app/media-engine.js';
import {loadStudioPage} from '../src/infrastructure/postgres-repository.js';
import {templates,publicImageUrl} from '../public/studio/graphics.js';
import {createStudioHandler} from '../src/web/studio-handler.js';
import {gameEventsResponse,lineupResponse,ids} from '../src/fixtures/real-game-sanitized.js';
import {normalizeHmsGame} from '../src/hms/normalize.js';
const env={HMS_API_TOKEN:'test-only',HMS_PHM_ORGANIZATION_ID:ids.org};
test('Prague dates cover midnight, month/year boundaries and DST without fixed 24h shifts',()=>{
  assert.deepEqual(timeWindow('Today',new Date('2026-10-24T22:30Z')),{from:'2026-10-25',to:'2026-10-25'});
  assert.deepEqual(timeWindow('Yesterday',new Date('2026-03-29T22:30Z')),{from:'2026-03-29',to:'2026-03-29'});
  assert.deepEqual(timeWindow('Tomorrow',new Date('2026-12-31T12:00Z')),{from:'2027-01-01',to:'2027-01-01'});
  assert.deepEqual(timeWindow('-7 days',new Date('2026-10-21T12:00Z')),{from:'2026-10-14',to:'2026-10-20'});
  assert.deepEqual(timeWindow('+7 days',new Date('2026-10-21T12:00Z')),{from:'2026-10-22',to:'2026-10-28'});
  assert.deepEqual(timeWindow('Past',new Date('2026-10-21T12:00Z'),1),{from:'2026-08-22',to:'2026-09-20'});
  assert.deepEqual(timeWindow('Future',new Date('2026-10-21T12:00Z'),1),{from:'2026-11-21',to:'2026-12-20'});
  assert.throws(()=>timeWindow('all'));
});
test('orgs fail closed, games use bounded dates/offset and reject foreign/out-of-range data',async()=>{
  assert.throws(()=>organizationConfig('EUCHL',env));assert.throws(()=>organizationConfig('phm',env));
  let query;
  const opts={env,now:new Date('2026-10-21T12:00Z'),fetchGames:async q=>{query=q;return [{gameId:ids.game,organizationId:ids.org,startDate:'2026-10-21',HomeTeam:{name:'A'},AwayTeam:{name:'B'},secret:'no'}];}};
  const result=await browseMedia({org:'PHM',offset:20},opts);
  assert.deepEqual(query,{from:'2026-10-21',to:'2026-10-21',limit:20,skip:20});assert.equal(result.items[0].secret,undefined);
  await assert.rejects(browseMedia({org:'PHM'},{...opts,fetchGames:async()=>[{gameId:ids.game,organizationId:'foreign',startDate:'2026-10-21'}]}));
  await assert.rejects(browseMedia({org:'PHM'},{...opts,fetchGames:async()=>[{gameId:ids.game,organizationId:ids.org,startDate:'2026-10-20'}]}));
  await assert.rejects(browseMedia({org:'PHM'},{...opts,fetchGames:async()=>[{gameId:ids.game,organizationId:ids.org}]}));
});
test('both SQL browsers scope organization and dates in parameters, fetch one lookahead',async()=>{
  for(const section of ['games','insights']){
    const calls=[];const page=await loadStudioPage({organizationId:ids.org,from:'2026-10-20',to:'2026-10-21',offset:20,limit:20,section,sql:{query:async(text,values)=>{calls.push({text,values});return Array.from({length:21},(_,i)=>({game_id:ids.game,priklep_id:String(i)}));}}});
    assert.match(calls[0].text,/organization_id=\$1::uuid/);assert.match(calls[0].text,/between \$2::date and \$3::date/);assert.deepEqual(calls[0].values,[ids.org,'2026-10-20','2026-10-21',21,20]);assert.equal(page.items.length,20);assert.equal(page.hasMore,true);
  }
});
test('live engine reuses normalizer without relaxing finished-only importer or generating achievements',async()=>{
  const detail={...gameEventsResponse,status:'LIVE',currentPeriod:2};
  assert.throws(()=>normalizeHmsGame(detail,lineupResponse),/dokončený/);
  const gameId=ids.game;
  const result=await mediaGame('PHM',gameId,{env,refresh:true,fetchResponses:async()=>[detail,detail,lineupResponse,null]});
  assert.equal(result.status,'LIVE');assert.deepEqual(result.priklepy,[]);assert.equal(result.org,'PHM');assert.equal(result.currentPeriod,2);assert.equal(result.organizationId,undefined);
  await assert.rejects(mediaGame('EUCHL',gameId,{env:{...env,HMS_EUCHL_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111'},refresh:true,fetchResponses:async()=>[detail,detail,lineupResponse,null]}));
});
test('templates suppress unknown/incorrect periods, use cumulative scores, require finished final',()=>{
  const game={status:'FINISHED',home:{score:9},away:{score:3},timeline:{coverage:'matches-result',periodScores:[{period:1,home:2,away:1},{period:2,home:3,away:0},{period:3,home:4,away:2}]}};
  assert.deepEqual(templates(game).map(t=>[t.id,t.home,t.away]),[['final',9,3],['period-1',2,1],['period-2',5,1],['period-3',9,3]]);
  assert.deepEqual(templates({...game,status:'LIVE'}),[]);
  assert.deepEqual(templates({...game,status:'LIVE',currentPeriod:2}).map(t=>t.id),['period-1']);
  assert.equal(templates({...game,timeline:{coverage:'score-mismatch'}}).length,1);
  assert.equal(templates({...game,home:{score:null}}).some(t=>t.id==='final'),false);
});
test('remote image URLs reject credentials, non HTTPS, IP and local hosts; no proxy exists',()=>{
  for(const url of ['http://example.com/a.png','https://user:password@example.com/x','https://127.0.0.1/x','https://[::1]/','https://metadata.google.internal/a','https://foo.local/a','file:///etc/passwd','data:image/svg+xml,hi'])assert.equal(publicImageUrl(url),null,url);
  assert.equal(publicImageUrl('https://example.com/logo.png'),'https://example.com/logo.png');
});
test('handler never returns backend errors, validates paging and is read-only',async()=>{
  const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(b){this.body=b;return this;}});
  let r=res();await createStudioHandler()({method:'POST'},r);assert.equal(r.code,405);
  r=res();await createStudioHandler()({method:'GET',query:{org:'PHM',offset:'NaN'}},r);assert.equal(r.code,400);
  r=res();await createStudioHandler({browseMedia:async()=>{throw new Error('private database connection');}})({method:'GET',query:{org:'PHM'}},r);assert.equal(r.code,503);assert.doesNotMatch(JSON.stringify(r.body),/private database/);
});
test('refresh coalesces reads, retains stored achievements and never mutates storage',async()=>{
  const gameId='22222222-2222-2222-2222-222222222222';
  const detail={...gameEventsResponse,gameId};
  const lineup={...lineupResponse,gameId};
  const {rowsFor}=await import('../src/infrastructure/analysis-rows.js');
  const {analyzeHmsResponses}=await import('../src/app/analyze.js');
  const rows=rowsFor(analyzeHmsResponses(detail,lineup,detail));
  const snapshot={game:rows.games[0],teams:rows.team_game_stats,players:rows.player_game_stats,goalies:rows.goalie_game_stats,priklepy:rows.detected_priklepy};
  let reads=0;
  const opts={env:{...env,DATABASE_URL:'test-only-not-a-connection'},refresh:true,loadSnapshot:async()=>snapshot,fetchResponses:async()=>{reads++;await new Promise(resolve=>setTimeout(resolve,1));return [detail,detail,lineup,null];}};
  const [a,b]=await Promise.all([mediaGame('PHM',gameId,opts),mediaGame('PHM',gameId,opts)]);
  assert.equal(reads,1);assert.equal(a,b);assert.ok(a.priklepy.length>0);
  await mediaGame('PHM',gameId,opts);assert.equal(reads,1);
  assert.equal(a.source,'HMS-read-only');
  await assert.rejects(mediaGame('YHG',gameId,{...opts,env:{...opts.env,HMS_YHG_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111'},refresh:false}),/organizaci/);
});
