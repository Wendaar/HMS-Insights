import test from 'node:test';
import assert from 'node:assert/strict';
import {createChannelHandler,channelState} from '../src/web/broadcast-channel.js';
export function memoryChannels(){const rows=new Map();return {
  async create(id,hash,state){const row={id,control_hash:hash,state,revision:1};rows.set(id,row);return row;},
  async get(id){return rows.get(id);},
  async update(id,hash,revision,state){const row=rows.get(id);if(!row||row.control_hash!==hash||row.revision!==revision)return null;const next={...row,state,revision:revision+1};rows.set(id,next);return next;},
};}
export const fixtureChannelState={org:'EUCHL',gameId:'6C02DF50-CE27-11F1-A5F0-6320901B5AD5',lang:'cs',layer:'opening',side:'home',period:'current',page:1,insight:'',visible:true};
export const channelTestEnv={HMS_EUCHL_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111',HMS_EUCHL_API_TOKEN:'server-token'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;}});
test('channel public URL can read but cannot control; keys are hashed and never returned by reads',async()=>{
  const store=memoryChannels(),handler=createChannelHandler({env:channelTestEnv,store}),headers={'content-type':'application/json'};
  const created=response();await handler({method:'POST',headers,body:{state:{...fixtureChannelState,token:'never-copy'}},query:{channels:'1'}},created);
  assert.equal(created.code,201);const {id,controlKey}=created.body;assert.match(id,/^[a-f0-9]{48}$/);assert.match(controlKey,/^[a-f0-9]{64}$/);
  assert.notEqual((await store.get(id)).control_hash,controlKey);assert.doesNotMatch(JSON.stringify(created.body.state),/token|never-copy/);
  const read=response();await handler({method:'GET',headers:{},query:{channel:id}},read);assert.equal(read.code,200);assert.doesNotMatch(JSON.stringify(read.body),/controlKey|control_hash|server-token/);
  const denied=response();await handler({method:'PATCH',headers,query:{channel:id},body:{state:fixtureChannelState,revision:1}},denied);assert.equal(denied.code,403);
  const wrong=response();await handler({method:'PATCH',headers:{...headers,authorization:'Bearer '+'a'.repeat(64)},query:{channel:id},body:{state:fixtureChannelState,revision:1}},wrong);assert.equal(wrong.code,409);
  const update=response();await handler({method:'PATCH',headers:{...headers,authorization:'Bearer '+controlKey},query:{channel:id},body:{state:{...fixtureChannelState,visible:false,lang:'en',layer:'lineup'},revision:1}},update);
  assert.equal(update.code,200);assert.equal(update.body.revision,2);assert.equal(update.body.state.visible,false);
  const stale=response();await handler({method:'PATCH',headers:{...headers,authorization:'Bearer '+controlKey},query:{channel:id},body:{state:fixtureChannelState,revision:1}},stale);assert.equal(stale.code,409);assert.equal((await store.get(id)).state.visible,false);
});
test('channel validates all output settings, forbids arbitrary URLs, and fails safely without storage',async()=>{
  for(const patch of [{org:'YHG'},{gameId:'bad'},{layer:'https://evil.test'},{page:0},{page:51},{visible:'yes'},{lang:'de'},{side:'foreign'},{period:'99'},{insight:'bad'}])assert.throws(()=>channelState({...fixtureChannelState,...patch},channelTestEnv));
  const handler=createChannelHandler({env:channelTestEnv,store:{get:async()=>{throw new Error('private database URL');}}});
  const res=response();await handler({method:'GET',headers:{},query:{channel:'a'.repeat(48)}},res);assert.equal(res.code,503);assert.doesNotMatch(JSON.stringify(res.body),/private|database/);
});
