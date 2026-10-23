import test from 'node:test';
import assert from 'node:assert/strict';
import {createBroadcastHandler,pregameModel} from '../src/web/broadcast-handler.js';
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
  let reads=0;const handler=createBroadcastHandler({env,fetchDetail:async(gameId,{config})=>{reads++;assert.equal(gameId,id);assert.equal(config.token,'euchl-only');assert.equal(config.retries,0);return detail();},fetchOrg:async()=>null});
  const a=response(),b=response();await Promise.all([handler(req(),a),handler(req(),b)]);assert.equal(reads,1);assert.equal(a.code,200);assert.equal(b.code,200);
  assert.equal(a.headers['access-control-allow-origin'],'https://wendaar.github.io');assert.equal(a.headers['cache-control'],'no-store');
  const c=response();await handler({...req(),headers:{origin:'https://evil.test'}},c);assert.equal(c.headers['access-control-allow-origin'],undefined);assert.equal(reads,1);
  const post=response();await handler({...req(),method:'POST'},post);assert.equal(post.code,405);
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
