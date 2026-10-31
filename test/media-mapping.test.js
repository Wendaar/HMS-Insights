import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {mediaPath,resolveMedia} from '../public/media-mapping/model.js';
import {mediaMapping,readMediaAssets} from '../src/app/media-mapping.js';
import {buildMediaCatalog} from '../scripts/build-media-catalog.js';
import {createMediaMappingHandler,mediaTool} from '../src/web/media-mapping-handler.js';
import {server} from '../src/server.js';
export const uid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
export function mappingMemory(){const data=new Map();return {async get(org,slug){return structuredClone(data.get(org+slug)??null);},async save(org,slug,draft,revision){const old=data.get(org+slug);if((old?.revision??0)!==revision)return null;const row={draft:structuredClone(draft),published:old?.published??null,revision:revision+1};data.set(org+slug,row);return structuredClone(row);},async publish(org,slug,revision){const row=data.get(org+slug);if(!row||row.revision!==revision)return null;row.published=structuredClone(row.draft);row.revision++;row.publishedAt='2026-10-31T15:00:00Z';return structuredClone(row);}};}
const assets=[{id:'general',path:'/media/audio/shared/test.wav',owner:'*'},{id:'team-song',path:'/media/audio/phm/team.mp3',owner:'PHM'},{id:'game-song',path:'/media/audio/phm/game.mp3',owner:'PHM'}];
const binding=(extra={})=>({scope:'default',targetId:null,cue:'goal',side:'both',assetId:'general',loop:false,volume:1,...extra});
const env={HMS_PHM_ORGANIZATION_ID:uid(1),HMS_PHM_API_TOKEN:'private-token',HMS_PHM_TOOLS_ADMIN_SECRET:'private-admin',HMS_EUCHL_ORGANIZATION_ID:uid(2),HMS_EUCHL_API_TOKEN:'other-token',HMS_EUCHL_TOOLS_ADMIN_SECRET:'other-admin'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;}});
const request=(action,body,extra={})=>({method:body?'POST':'GET',headers:{host:'example.test','content-type':'application/json',authorization:'Bearer private-admin'},query:{org:'PHM',action},body,...extra});
test('catalog paths accept encoded Czech names but reject traversal and arbitrary URLs',()=>{
  assert.equal(mediaPath('/media/audio/phm/Goal%20VOHOLTO.mp3'),'/media/audio/phm/Goal%20VOHOLTO.mp3');
  for(const path of ['https://evil.test/a.mp3','/media/audio/phm/../a.mp3','/media/audio/phm/%2e%2e/a.mp3','/media/audio/phm/a%2fb.mp3','/media/audio/phm/a.mp3?token=secret','/media/audio/phm/a.js','/media/audio/phm/%00.wav'])assert.equal(mediaPath(path),null,path);
});
test('inventory generates stable path identities, file versions and explicit organization ownership',async()=>{
  const root=await mkdtemp(join(tmpdir(),'hms-media-test-'));try{await mkdir(join(root,'public/media/audio/phm'),{recursive:true});await mkdir(join(root,'public/media/audio/shared'));await writeFile(join(root,'public/media/audio/phm/VOHOLTO goal.mp3'),'owned test bytes');
    const first=await buildMediaCatalog(root,[{slug:'phm',code:'PHM'}]);assert.equal(first.assets[0].owner,'PHM');assert.match(first.assets[0].path,/VOHOLTO%20goal.mp3/);
    await writeFile(join(root,'public/media/audio/phm/VOHOLTO goal.mp3'),'updated test bytes');const second=await buildMediaCatalog(root,[{slug:'phm',code:'PHM'}]);assert.equal(first.assets[0].id,second.assets[0].id);assert.notEqual(first.assets[0].checksum,second.assets[0].checksum);
    await mkdir(join(root,'public/media/audio/unknown'));await writeFile(join(root,'public/media/audio/unknown/test.wav'),'audio');await assert.rejects(()=>buildMediaCatalog(root,[{slug:'phm',code:'PHM'}]),/Unknown media organization/);
  }finally{const target=resolve(root);assert.ok(target.startsWith(resolve(tmpdir())+sep));await rm(target,{recursive:true,force:true});}
});
test('schema rejects duplicate slots, invalid identities and missing files',()=>{
  assert.throws(()=>mediaMapping({schemaVersion:1,bindings:[binding(),binding()]},'PHM',assets),/více zvuků/);
  assert.throws(()=>mediaMapping({schemaVersion:1,bindings:[binding({scope:'team',targetId:'not-an-id'})]},'PHM',assets),/HMS ID/);
  assert.throws(()=>mediaMapping({schemaVersion:1,bindings:[binding({assetId:'missing'})]},'PHM',assets));
  assert.throws(()=>mediaMapping({schemaVersion:1,bindings:[binding({scope:'sponsor',targetId:uid(9),cue:'goal'})]},'PHM',assets));
});
test('resolution is game+side, game+both, team, side default, general default, with no cross-org fallback',()=>{
  const context={org:'PHM',gameId:uid(3),homeId:uid(4),awayId:uid(5),cue:'goal',side:'home'};
  const rows=[binding(),binding({side:'home',assetId:'team-song'}),binding({scope:'team',targetId:uid(4),assetId:'team-song'}),binding({scope:'game',targetId:uid(3),assetId:'general'}),binding({scope:'game',targetId:uid(3),side:'home',assetId:'game-song'})];
  const config=mediaMapping({schemaVersion:1,bindings:rows},'PHM',assets);assert.equal(resolveMedia(config,assets,context).asset.id,'game-song');config.bindings.pop();assert.equal(resolveMedia(config,assets,context).source,'game');config.bindings.pop();assert.equal(resolveMedia(config,assets,context).source,'team');
  assert.equal(resolveMedia(config,assets,{...context,org:'EUCHL'}),null);
  const unavailable=resolveMedia({...config,bindings:[binding({assetId:'deleted'})]},assets,context);assert.equal(unavailable.asset,null);assert.equal(unavailable.source,'default');
  const sponsor=mediaMapping({schemaVersion:1,bindings:[binding({scope:'sponsor',targetId:uid(6),cue:'ad'})]},'PHM',assets);assert.equal(resolveMedia(sponsor,assets,{...context,cue:'ad:hms:'+uid(6)}).source,'sponsor');
});
test('central save/publish uses organization authorization and revision checks; public never exposes draft',async()=>{
  const store=mappingMemory(),handler=createMediaMappingHandler({env,store,readAssets:async()=>assets});
  for(const token of ['', 'Bearer wrong','Bearer other-admin']){const r=response();await handler(request('save',{revision:0,config:{schemaVersion:1,bindings:[binding()]}},{headers:{authorization:token,'content-type':'application/json'}}),r);assert.equal(r.code,401);}
  const badOrigin=response();await handler(request('save',{revision:0},{headers:{host:'example.test',origin:'https://foreign.test',authorization:'Bearer private-admin'}}),badOrigin);assert.equal(badOrigin.code,403);
  const saved=response();await handler(request('save',{revision:0,config:{schemaVersion:1,bindings:[binding()]}}),saved);assert.equal(saved.code,200);assert.equal(saved.body.instance.revision,1);
  const pub=response();await handler(request('public'),pub);assert.equal(pub.body.config.bindings.length,0);assert.doesNotMatch(JSON.stringify(pub.body),/private-/);
  const published=response();await handler(request('publish',{revision:1}),published);assert.equal(published.code,200);const live=response();await handler(request('public'),live);assert.equal(live.body.config.bindings.length,1);
  const conflict=response();await handler(request('save',{revision:1,config:{schemaVersion:1,bindings:[]}}),conflict);assert.equal(conflict.code,409);
});
test('team/sponsor/match writes revalidate HMS ownership and use only the selected token',async()=>{
  const store=mappingMemory(),handler=createMediaMappingHandler({env,store,readAssets:async()=>assets,loadSponsors:async org=>{assert.equal(org.token,'private-token');return {org:'PHM',teams:[{id:uid(4)}],items:[{id:uid(6)}]};},fetchDetail:async(id,{config})=>{assert.equal(config.token,'private-token');return {gameId:id,organizationId:uid(99)};}});
  for(const b of [binding({scope:'team',targetId:uid(99)}),binding({scope:'sponsor',targetId:uid(99),cue:'ad'}),binding({scope:'game',targetId:uid(3)})]){const r=response();await handler(request('save',{revision:0,config:{schemaVersion:1,bindings:[b]}}),r);assert.equal(r.code,400);}
  assert.equal(await store.get('PHM','library'),null);
  const r=response();await handler(request('save',{revision:0,config:{schemaVersion:1,bindings:[binding({scope:'team',targetId:uid(4)}),binding({scope:'sponsor',targetId:uid(6),cue:'ad'})]}}),r);assert.equal(r.code,200);
});
test('preview storage namespace is separate and deleted assets cannot be published',async()=>{
  assert.equal(mediaTool({VERCEL_ENV:'production'}),'media-mapping');assert.equal(mediaTool({VERCEL_ENV:'preview'}),'media-mapping-preview');assert.equal(mediaTool({}),'media-mapping-preview');
  const store=mappingMemory();await store.save('PHM','library',{schemaVersion:1,org:'PHM',bindings:[binding()]},0);const handler=createMediaMappingHandler({env,store,readAssets:async()=>[]}),r=response();await handler(request('publish',{revision:1}),r);assert.equal(r.code,400);assert.equal((await store.get('PHM','library')).published,null);
});
test('existing Operations code can manage its own organization without replacing the Tools Admin code',async()=>{
  const scopedEnv={...env,HMS_PHM_OPERATIONS_SECRET:'phm-operations-code',HMS_EUCHL_OPERATIONS_SECRET:'euchl-operations-code'},store=mappingMemory(),handler=createMediaMappingHandler({env:scopedEnv,store,readAssets:async()=>assets});
  for(const key of ['private-admin','phm-operations-code']){const r=response();await handler(request('manage',undefined,{headers:{authorization:'Bearer '+key}}),r);assert.equal(r.code,200);}
  const access=response();await handler(request('access'),access);assert.equal(access.body.operationsConfigured,true);assert.doesNotMatch(JSON.stringify(access.body),/phm-operations-code|private-admin/);
  const foreign=response();await handler(request('manage',undefined,{query:{org:'EUCHL',action:'manage'},headers:{authorization:'Bearer phm-operations-code'}}),foreign);assert.equal(foreign.code,401);
  const badOrigin=response();await handler(request('save',{revision:0,config:{schemaVersion:1,bindings:[]}},{headers:{host:'example.test',origin:'https://foreign.test',authorization:'Bearer phm-operations-code'}}),badOrigin);assert.equal(badOrigin.code,403);
  const onlyOperations=createMediaMappingHandler({env:{HMS_PHM_OPERATIONS_SECRET:'phm-operations-code'},store,readAssets:async()=>assets}),saved=response();await onlyOperations(request('save',{revision:0,config:{schemaVersion:1,bindings:[binding()]}},{headers:{'content-type':'application/json',authorization:'Bearer phm-operations-code'}}),saved);assert.equal(saved.code,200);
  const published=response();await onlyOperations(request('publish',{revision:1},{headers:{'content-type':'application/json',authorization:'Bearer phm-operations-code'}}),published);assert.equal(published.code,200);
});
test('the real bundled inventory and editor/audio routes are available without fabricating a central save',async()=>{
  const actual=await readMediaAssets('PHM');assert.ok(actual.some(a=>a.path.endsWith('test-tone.wav')));assert.ok(actual.every(a=>a.owner==='*'||a.owner==='PHM'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;try{for(const path of ['/studio/media-mapping','/media-mapping/app.js','/media-mapping/model.js'])assert.equal((await fetch(root+path)).status,200);const wav=await fetch(root+'/media/audio/shared/test-tone.wav');assert.equal(wav.status,200);assert.equal(Buffer.from(await wav.arrayBuffer()).toString('ascii',0,4),'RIFF');const r=await fetch(root+'/api/media-mapping?org=PHM&action=save',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.ok([401,503].includes(r.status));}finally{await new Promise(r=>server.close(r));}
});
