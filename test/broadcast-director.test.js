import test from 'node:test';
import assert from 'node:assert/strict';
import {createChannelHandler,channelState} from '../src/web/broadcast-channel.js';
import {directorDefaults,mixerFromState,effectiveLayers,availability,graphics} from '../public/broadcast/director-model.js';
import {renderMatchLayer,layers} from '../public/broadcast/match-layers.js';
import {createDirectorData} from '../public/broadcast/director-data.js';
import {resolvePartnerFrame} from '../public/broadcast/extra-layers.js';
const id='6C02DF50-CE27-11F1-A5F0-6320901B5AD5';
const env={HMS_EUCHL_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111',HMS_EUCHL_API_TOKEN:'test'};
const legacy={...directorDefaults(),org:'EUCHL',gameId:id,lang:'cs',layer:'lineup',visible:true};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
test('director data coalesces layer requests and hydrates late context into the same scoped model',async()=>{
 const reads=[];let release;
 const raw={schemaVersion:1,org:'EUCHL',gameId:id,home:{name:'Home'},away:{name:'Away'}};
 const source=createDirectorData({fetchImpl:async url=>{const q=new URL(url).searchParams;reads.push(q.has('context')?'context':'game');if(q.has('context'))await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({...raw,...(q.has('context')?{context:{historyAvailable:true,nextAvailable:true}}:{})})};}});
 const scope={org:'EUCHL',gameId:id,layer:'next'};
 source.get(scope);source.get({...scope,layer:'results'});await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(reads,['game','context']);assert.equal(source.get(scope).game.context,null);
 release();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(source.get(scope).game.context.nextAvailable,true);assert.equal(reads.length,2);source.stop();
});
test('V2 explicit partner selection is independent of its rotation checklist and stays scoped',()=>{
 const game={ID:id,homeId:id},catalog={org:'EUCHL',items:[{id,name:'Selected partner'}],bindings:[]};
 const settings={org:'EUCHL',layout:'compact',layer:'announcement',partnerScope:'organization',partnerSource:'hms',assetId:id,sponsorCatalog:catalog,items:[{kind:'hms-sponsor',org:'EUCHL',scope:'game',targetId:id,sponsorId:id,enabled:false}],sponsorRotation:{enabled:false,showSeconds:15,pauseSeconds:0,startedAt:0}};
 assert.equal(resolvePartnerFrame(game,settings).item.title,'Selected partner');
 assert.equal(resolvePartnerFrame(game,{...settings,org:'PHM'}).item,null);
});
test('V2 state preserves legacy contracts and validates both independent layers',()=>{
 assert.equal(channelState(legacy,env).directorVersion,undefined);
 const v2=mixerFromState(legacy);assert.equal(channelState(v2,env).sponsors.visible,false);
 for(const corner of ['top-left','top-right','bottom-left','bottom-right'])assert.equal(channelState({...v2,sponsors:{...v2.sponsors,corner}},env).sponsors.corner,corner);
 for(const patch of [{directorVersion:3},{mainVisible:'true'},{sponsors:{...v2.sponsors,layer:'opening'}},{sponsors:{...v2.sponsors,corner:'wrong'}},{sponsors:{...v2.sponsors,stacking:'script'}},{sponsors:{...v2.sponsors,directorVersion:2}},{sponsors:{...v2.sponsors,sponsorRotation:{enabled:true}}}])assert.throws(()=>channelState({...v2,...patch},env));
 for(const layer of layers)assert.ok(graphics.some(g=>g.id===layer),layer+' omitted from director');
});
test('atomic emergency hide wins against late publishes, bypasses HMS and remains authenticated',async()=>{
 let stored;const store={async create(id,hash,state){return stored={id,control_hash:hash,state,revision:1};},async get(){return stored;},async update(id,hash,revision,state){if(hash!==stored.control_hash||revision!==stored.revision)return null;return stored={...stored,state,revision:revision+1};},async hide(id,hash){if(hash!==stored.control_hash)return null;return stored={...stored,state:{...stored.state,visible:false,mainVisible:false,sponsors:{...stored.state.sponsors,visible:false}},revision:stored.revision+1};}};
 const handler=createChannelHandler({env,store}),headers={'content-type':'application/json'},created=response();
 await handler({method:'POST',headers,query:{channels:'1'},body:{state:mixerFromState(legacy)}},created);assert.equal(created.code,201);
 const {id:channel,controlKey}=created.body,authorized={...headers,authorization:'Bearer '+controlKey};
 const hidden=response();await createChannelHandler({env:{},store})({method:'PATCH',headers:authorized,query:{channel},body:{action:'hide-all'}},hidden);
 assert.equal(hidden.code,200);assert.equal(stored.state.visible,false);assert.equal(stored.state.sponsors.visible,false);
 const late=response();await handler({method:'PATCH',headers:authorized,query:{channel},body:{state:mixerFromState(legacy),revision:1}},late);assert.equal(late.code,409);assert.equal(stored.state.visible,false);
 const denied=response();await handler({method:'PATCH',headers,query:{channel},body:{action:'hide-all'}},denied);assert.equal(denied.code,403);
});
test('collision rules cover partners without changing their logical state',()=>{
 const state=mixerFromState({...legacy,layer:'leaders-strip',corner:'top-left'});state.sponsors.visible=true;
 assert.deepEqual(effectiveLayers(state),{main:true,sponsors:true,covered:false});
 state.layer='lineup';assert.deepEqual(effectiveLayers(state),{main:true,sponsors:true,covered:false});
 state.sponsors.stacking='auto-hide';state.layer='leaders-strip';
 state.layer='lineup';assert.deepEqual(effectiveLayers(state),{main:true,sponsors:false,covered:true});assert.equal(state.sponsors.visible,true);
 state.mainVisible=false;assert.equal(effectiveLayers(state).sponsors,true);
 state.visible=false;assert.deepEqual(effectiveLayers(state),{main:false,sponsors:false,covered:false});
});
test('availability distinguishes zero goals, unknown events, partial roster and planned adapters',()=>{
 const game={status:'LIVE',match:{coverage:'matches-score',score:{home:0,away:0},goals:[],insights:[],lineupAvailable:true,roster:[{side:'home',name:'Player',number:1}]}};
 assert.equal(availability('scoresheet',game).state,'WAITING FOR DATA');game.match.coverage='unavailable';assert.equal(availability('scoresheet',game).state,'UNAVAILABLE');
 assert.equal(availability('lineup',game).state,'INCOMPLETE');assert.equal(availability('stars',game).state,'UNAVAILABLE');assert.equal(availability('opening',game,{error:true}).usable,false);
});
test('compact rendering fits ordinary rosters/goals in one page and retains bounded overflow pages',()=>{
 const game={'Home Team':'Home','Away Team':'Away',match:{coverage:'matches-score',lineupAvailable:true,roster:Array.from({length:40},(_,i)=>({id:String(i),side:i<20?'home':'away',number:i%20+1,name:'Player '+i})),goals:Array.from({length:7},(_,i)=>({side:i%2?'away':'home',clock:`${i}:00`,period:1,scorer:{name:'Scorer '+i},assists:[{name:'Assist'}]}))}};
 const lineup=renderMatchLayer(game,{layer:'lineup',side:'both',layout:'compact'});assert.equal((lineup.match(/<li>/g)??[]).length,40);assert.doesNotMatch(lineup,/class="page-label"/);
 const score=renderMatchLayer(game,{layer:'scoresheet',side:'both',layout:'compact'});assert.equal((score.match(/<li data-side/g)??[]).length,7);assert.doesNotMatch(score,/class="page-label"/);
 game.match.roster=Array.from({length:45},(_,i)=>({side:'home',name:'Player '+i}));const second=renderMatchLayer(game,{layer:'lineup',side:'home',layout:'compact',page:2});assert.equal((second.match(/<li>/g)??[]).length,21);assert.match(second,/2 \/ 2/);
 const legacyMarkup=renderMatchLayer(game,{layer:'lineup',side:'home'});assert.equal((legacyMarkup.match(/<li>/g)??[]).length,20);assert.doesNotMatch(legacyMarkup,/compact-broadcast/);
});
