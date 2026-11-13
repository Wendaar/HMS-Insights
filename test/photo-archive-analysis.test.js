import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoArchive} from '../src/app/photo-archive.js';
import {createPhotoArchiveHandler} from '../src/web/photo-archive-handler.js';
const game='11111111-1111-4111-8111-111111111111',player='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/hms-photo-archive-pilot',OPENAI_API_KEY:'fake-private-key',PHOTO_VISION_MODEL:'gpt-6-luna',HMS_PHM_OPERATIONS_SECRET:'fixture-secret'};
const output={model:'gpt-6-luna',usage:{inputTokens:500,outputTokens:100,totalTokens:600},observations:[{observedNumber:'22',jerseyNumber:'22',confidence:0.95,teamId:null,evidence:'Visible 22'}]};
async function setup(analyzer=async()=>output){
  let row=null,calls=0;const store={async get(){return structuredClone(row);},async save(org,slug,draft,revision){if((row?.revision || 0)!==revision)return null;row={draft:structuredClone(draft),revision:revision+1};return structuredClone(row);}};
  let clock=Date.parse('2026-11-09T00:00:00Z');
  const options={env,store,readCases:async()=>[{org:'PHM',gameId:game,flickrAlbum:'https://flic.kr/s/test'}],now:()=>clock,
    analyzer:async(...args)=>{calls++;return analyzer(...args);},loadSource:async()=>({gameId:game,title:'Fixture',teams:[],players:[{playerId:player,name:'Adam',jerseyNumber:'22',teamId:'home'}],
      albumId:'1',albumTotal:3,photos:['101','102','103'].map(id=>({id,previewUrl:`https://live.staticflickr.com/1/${id}_b.jpg`}))})};
  const service=createPhotoArchive(options);await service.importCase('PHM',game,0);
  return {service,store,options,get calls(){return calls;},advance(){clock+=121000;}};
}
const start=(service,revision=1,extra={})=>service.startAnalysis('PHM',{gameId:game,revision,limit:3,...extra});
const next=(service,v)=>service.nextAnalysis('PHM',{gameId:game,revision:v.revision,jobId:v.state.analysisJob.id});
test('album analysis persists observations, proposes real roster names, resumes and skips cached paid work',async()=>{
  const f=await setup();let v=await start(f.service,1,{limit:1});v=await next(f.service,v);
  assert.equal(v.state.analysisJob.status,'completed');assert.equal(v.state.photos[0].suggestions[0].candidates[0].name,'Adam');assert.equal(v.stats.confirmed,0);
  assert.equal(v.analysisStats.complete,1);assert.equal(f.calls,1);
  await f.service.importCase('PHM',game,v.revision);const reopened=createPhotoArchive(f.options);v=await reopened.read('PHM',game);
  assert.equal(v.analysisStats.complete,1);v=await start(reopened,v.revision);v=await next(reopened,v);v=await next(reopened,v);
  assert.equal(v.analysisStats.complete,3);assert.equal(f.calls,3);v=await start(reopened,v.revision);assert.equal(v.state.analysisJob.status,'completed');assert.equal(f.calls,3);
  assert.deepEqual(await reopened.archive('PHM'),[]);
});
test('a durable claim prevents simultaneous duplicate model calls and merges concurrent human review',async()=>{
  let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const f=await setup(async()=>{entered();await gate;return output;});const v=await start(f.service);const pending=next(f.service,v);await started;
  await assert.rejects(next(f.service,v),e=>e.status===409);let current=await f.service.read('PHM',game);
  await assert.rejects(start(f.service,current.revision),e=>e.status===409);
  await f.service.decide('PHM',{gameId:game,photoId:'102',revision:current.revision,decision:'assign',playerIds:[player],reviewer:'Human'},'operations:PHM');
  release();current=await pending;assert.equal(f.calls,1);assert.equal(current.stats.confirmed,1);assert.equal(current.state.photos[0].analysis.status,'complete');
});
test('provider failure stops the album, redacts secrets and requires an explicit retry of failed images',async()=>{
  let fail=true;const f=await setup(async()=>{if(fail)throw Error('Vision API HTTP 429 (code=credit_balance_exhausted) fake-private-key');return output;});
  let v=await start(f.service);v=await next(f.service,v);assert.equal(v.state.analysisJob.status,'failed');assert.equal(v.state.analysisJob.lastError,'quota');
  assert.doesNotMatch(JSON.stringify(v),/fake-private-key/);assert.equal(f.calls,1);
  fail=false;v=await start(f.service,v.revision,{limit:1});assert.deepEqual(v.state.analysisJob.targets,['102']);v=await next(f.service,v);
  v=await start(f.service,v.revision,{limit:1,retryFailed:true});assert.deepEqual(v.state.analysisJob.targets,['101']);v=await next(f.service,v);assert.equal(v.state.photos[0].analysis.status,'complete');
});
test('unknown interrupted claims are never silently retried; explicit retry is bounded',async()=>{
  const f=await setup();let v=await start(f.service);let row=await f.store.get();row.draft.analyses={'101':{status:'processing',claim:'old',startedAt:'2026-11-09T00:00:00Z'}};await f.store.save('PHM',game,row.draft,row.revision);
  f.advance();v=await f.service.read('PHM',game);v=await start(f.service,v.revision,{limit:1});assert.deepEqual(v.state.analysisJob.targets,['102']);assert.equal(v.state.analyses['101'].error,'interrupted');assert.equal(f.calls,0);
  await assert.rejects(start(f.service,v.revision,{limit:251}),e=>e.status===400);
});
test('empty successful observations stay cached and no failed reservation can spend credits',async()=>{
  const f=await setup(async()=>({...output,observations:[]}));let v=await start(f.service,1,{limit:1});v=await next(f.service,v);assert.equal(v.analysisStats.complete,1);assert.deepEqual(v.state.photos[0].observations,[]);
  const noSave={...f.options,store:{get:f.store.get,save:async()=>null}};const service=createPhotoArchive(noSave);
  await assert.rejects(start(service,v.revision),e=>e.status===409);assert.equal(f.calls,1);
});
test('AI HTTP actions require Operations auth, POST, same origin, storage and pinned model before any spending',async()=>{
  const f=await setup(),handler=createPhotoArchiveHandler({...f.options,service:f.service});
  async function call(method,headers={},body={gameId:game,revision:1}){const r={setHeader(){},status(code){this.code=code;return this;},json(data){this.body=data;}};await handler({method,headers:{host:'preview.test','content-type':'application/json',...headers},query:{org:'phm',action:'analyze-start'},body},r);return r;}
  assert.equal((await call('POST')).code,401);assert.equal((await call('GET',{authorization:'Bearer fixture-secret'})).code,405);
  assert.equal((await call('POST',{authorization:'Bearer fixture-secret',origin:'https://evil.test'})).code,403);assert.equal(f.calls,0);
  const bad=createPhotoArchive({...f.options,env:{...env,PHOTO_VISION_MODEL:'unexpected'}});await assert.rejects(start(bad),e=>e.status===503);
  assert.equal((await call('POST',{authorization:'Bearer fixture-secret'})).code,200);assert.equal(f.calls,0);
});
test('older cached observations are re-read only after explicit upgrade and only for the requested photo',async()=>{
  const f=await setup();let row=await f.store.get();row.draft.analyses={'101':{status:'complete',observations:output.observations,model:'gpt-6-luna'}};
  await f.store.save('PHM',game,row.draft,row.revision);let v=await f.service.read('PHM',game);assert.equal(v.analysisStats.outdated,1);
  v=await start(f.service,v.revision,{photoId:'101'});assert.equal(v.state.analysisJob.targets.length,0);assert.equal(f.calls,0);
  v=await start(f.service,v.revision,{photoId:'101',upgradeOld:true});v=await next(f.service,v);assert.equal(f.calls,1);assert.equal(v.analysisStats.outdated,0);assert.equal(v.state.photos[0].analysis.analysisVersion,2);
  await assert.rejects(start(f.service,v.revision,{photoId:'foreign',upgradeOld:true}),e=>e.status===400);
});
