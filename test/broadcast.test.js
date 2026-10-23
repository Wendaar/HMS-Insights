import test from 'node:test';
import assert from 'node:assert/strict';
import {createBroadcastHandler,pregameModel,enrichPregame} from '../src/web/broadcast-handler.js';
import {HmsRequestError,fetchGameDetail} from '../src/hms/client.js';
const id='6C02DF50-CE27-11F1-A5F0-6320901B5AD5',orgId='11111111-1111-1111-1111-111111111111';
const detail=()=>({gameId:id,organizationId:orgId,status:'NOT PLAYED',startDate:'2026-10-23',startTime:'21:15:00',
  HomeTeam:{teamId:'365A02A0-C4FB-11F1-8AD4-9967CDC84598',name:'Prague Guardians'},AwayTeam:{teamId:'2992D0D0-CE27-11F1-A5F0-6320901B5AD5',name:'Bratislava Capitals'},
  Venue:{name:'ICERINK (Yellow) - Prague CZ'},Phase:{name:'Regular phase',Group:{name:'Division One',Season:{Competition:{name:'European Union College Hockey League'}}}},
  referee:[{firstName:'Jan',lastName:'Test',email:'secret@example.com'}],timekeeper:null,body:'private',token:'private'});
const env={HMS_EUCHL_ORGANIZATION_ID:orgId,HMS_EUCHL_API_TOKEN:'euchl-only',HMS_API_TOKEN:'phm-only'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;}});
const req=(q={})=>({method:'GET',headers:{origin:'https://wendaar.github.io'},query:{org:'EUCHL',gameId:id,...q}});
test('pregame allowlists sporting data and preserves Prague calendar time and absent officials',()=>{
  const data=pregameModel(detail(),{code:'EUCHL',id:orgId},id);
  assert.equal(data.time,'21:15');assert.equal(data.date,'2026-10-23');assert.equal(data.referee,'Jan Test');assert.equal(data.timekeeper,null);
  assert.equal(data.home.name,'Prague Guardians');assert.equal(data.competition,'European Union College Hockey League');assert.equal(data.source,'HMS API');
  assert.doesNotMatch(JSON.stringify(data),/private|email|secret@/);
  assert.throws(()=>pregameModel({...detail(),organizationId:'wrong'},{code:'EUCHL',id:orgId},id));
  assert.throws(()=>pregameModel(detail(),{code:'EUCHL',id:orgId},'wrong'));
});
test('broadcast scopes its token, coalesces/caches reads, allows Pages CORS and never writes',async()=>{
  let reads=0;const handler=createBroadcastHandler({env,fetchDetail:async(gameId,{config})=>{reads++;assert.equal(gameId,id);assert.equal(config.token,'euchl-only');assert.equal(config.retries,0);return detail();},fetchMetadata:async()=>null,fetchOrg:async()=>null});
  const a=response(),b=response();await Promise.all([handler(req(),a),handler(req(),b)]);assert.equal(reads,1);assert.equal(a.code,200);assert.equal(b.code,200);
  assert.equal(a.headers['access-control-allow-origin'],'https://wendaar.github.io');assert.equal(a.headers['cache-control'],'no-store');
  const c=response();await handler({...req(),headers:{origin:'https://evil.test'}},c);assert.equal(c.headers['access-control-allow-origin'],undefined);assert.equal(reads,1);
  const post=response();await handler({...req(),method:'POST'},post);assert.equal(post.code,405);
});
test('thin authenticated fixtures take public names only after both team IDs and date match',()=>{
  const original=detail(),thin={...original,homeTeamId:original.HomeTeam.teamId,awayTeamId:original.AwayTeam.teamId,HomeTeam:undefined,AwayTeam:undefined,Venue:undefined,Phase:undefined};
  const enriched=enrichPregame(thin,original);assert.equal(pregameModel(enriched,{code:'EUCHL',id:orgId},id).home.name,'Prague Guardians');
  assert.equal(pregameModel(enriched,{code:'EUCHL',id:orgId},id).venue,'ICERINK (Yellow) - Prague CZ');
  assert.equal(enrichPregame(thin,{...original,startDate:'2026-10-24'}),thin);
  assert.equal(enrichPregame(thin,{...original,AwayTeam:{teamId:'wrong'}}),thin);
});
test('unknown/missing orgs, foreign games and unavailable data never fall back to PHM',async()=>{
  let reads=0;const handler=createBroadcastHandler({env,fetchDetail:async()=>{reads++;return {...detail(),organizationId:'wrong'};}});
  for(const query of [{org:'unknown'},{org:'YHG'},{gameId:'invalid'}]){const r=response();await handler(req(query),r);assert.ok([400,503].includes(r.code));}
  assert.equal(reads,0);
  const foreign=response();await handler(req(),foreign);assert.equal(foreign.code,503);assert.doesNotMatch(JSON.stringify(foreign.body),/euchl-only|wrong|phm-only/);
});
test('broadcast game picker passes explicit filter and bounded page to the existing HMS browser',async()=>{
  const handler=createBroadcastHandler({env,browse:async(q)=>{assert.deepEqual(q,{org:'EUCHL',filter:'Tomorrow',offset:20});return {items:[],source:'HMS',hasMore:false};}});
  const r=response();await handler(req({gameId:undefined,filter:'Tomorrow',offset:'20'}),r);assert.equal(r.code,200);assert.equal(r.body.org,'EUCHL');
  const bad=response();await handler(req({gameId:undefined,offset:'-1'}),bad);assert.equal(bad.code,400);
});
test('live reads keep the scoped token, separate their cache and survive an unavailable lineup',async()=>{
  let reads=0;const handler=createBroadcastHandler({env,fetchDetail:async()=>detail(),fetchMetadata:async()=>null,fetchOrg:async()=>null,
    fetchEvents:async(gameId,{config})=>{reads++;assert.equal(config.token,'euchl-only');return {gameId,events:[]};},fetchLineup:async()=>{throw new Error('offline private error');}});
  const opening=response();await handler(req(),opening);assert.equal(reads,0);assert.equal(opening.body.match,undefined);
  const live=response();await handler(req({live:'1'}),live);assert.equal(reads,1);assert.equal(live.code,200);assert.deepEqual(live.body.match.roster,[]);assert.equal(live.body.match.lineupAvailable,false);
  assert.doesNotMatch(JSON.stringify(live.body),/offline|private error|euchl-only/);
});
test('HMS failures distinguish access, quota, upstream and transport without exposing credentials',async()=>{
  for(const [status,code] of [[401,'hms_auth'],[403,'hms_auth'],[429,'hms_rate_limit'],[500,'hms_upstream']]){
    const handler=createBroadcastHandler({env,fetchDetail:async()=>{throw new HmsRequestError(status,'/api/v1/game',42);}}),r=response();
    await handler(req(),r);assert.equal(r.code,503);assert.equal(r.body.code,code);assert.equal(r.body.upstreamStatus,status);assert.doesNotMatch(JSON.stringify(r.body),/euchl-only|phm-only|api\/v1/);
  }
  const handler=createBroadcastHandler({env,fetchDetail:async()=>{throw new TypeError('fetch failed');}}),r=response();await handler(req(),r);assert.equal(r.code,503);
});
test('an HMS rate limit prevents further upstream reads during its bounded cooldown',async()=>{
  let reads=0;const handler=createBroadcastHandler({env,fetchDetail:async()=>{reads++;throw new HmsRequestError(429,'/api/v1/game',30);},browse:async()=>{reads++;throw new Error('must not fetch');}});
  for(const query of [{},{},{gameId:undefined}]){const r=response();await handler(req(query),r);assert.equal(r.body.code,'hms_rate_limit');assert.equal(r.headers['retry-after'],'30');}
  assert.equal(reads,1);
});
test('HMS transport retains only status and bounded retry metadata on failed responses',async()=>{
  await assert.rejects(()=>fetchGameDetail(id,{config:{token:'secret-token',baseUrl:'https://example.test',retries:0},fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'9999'})})}),e=>e instanceof HmsRequestError&&e.status===429&&e.retryAfter===300&&!e.message.includes('secret-token'));
});
