import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoArchive,photoArchiveEnabled,PHOTO_ARCHIVE_TOOL,flickrImage} from '../src/app/photo-archive.js';
import {createPhotoArchiveHandler} from '../src/web/photo-archive-handler.js';
import {sessionCookie} from '../src/security/operations-session.js';
import {server} from '../src/server.js';

const game='11111111-1111-4111-8111-111111111111',game2='22222222-2222-4222-8222-222222222222';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cases=[{org:'PHM',gameId:game,flickrAlbum:'https://flic.kr/s/fixture1'},{org:'PHM',gameId:game2,flickrAlbum:'https://flic.kr/s/fixture2'}];
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/hms-photo-archive-pilot',HMS_PHM_OPERATIONS_SECRET:'review-secret'};
const source=id=>({gameId:id,title:'Domácí × Hosté',playedOn:'2026-11-01',teams:[{teamId:'home',name:'Domácí'},{teamId:'away',name:'Hosté'}],
  players:[{playerId:a,teamId:'home',name:'Adam Novák',jerseyNumber:id===game?'22':'17'},{playerId:b,teamId:'away',name:'Boris Nový',jerseyNumber:'22'}],
  albumId:'72177720336372497',albumTotal:2,photos:[{id:id===game?'55635051690':'55633060430',previewUrl:'https://live.staticflickr.com/1/example_b.jpg',thumbnailUrl:'https://live.staticflickr.com/1/example_s.jpg'},
    {id:id===game?'123':'456',previewUrl:'https://evil.test/image.jpg'}]});
function memoryStore(){
  const rows=new Map();let writes=0;
  return {rows,get writes(){return writes;},async get(org,slug){return structuredClone(rows.get(org+slug) || null);},async save(org,slug,draft,revision){
    const existing=rows.get(org+slug);if((existing?.revision || 0)!==revision)return null;
    const row={draft:structuredClone(draft),revision:revision+1,updatedAt:'2026-11-08T00:00:00Z'};rows.set(org+slug,row);writes++;return structuredClone(row);
  }};
}
function fixture(){const store=memoryStore();return {store,service:createPhotoArchive({env,store,readCases:async()=>cases,loadSource:async(org,item)=>source(item.gameId),now:()=>Date.parse('2026-11-08T12:00:00Z')})};}
const decision=(revision,extra={})=>({gameId:game,photoId:'55635051690',decision:'assign',revision,playerIds:[a],reviewer:'Tester',note:'Hráč vlevo',...extra});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request=(action,body,headers={authorization:'Bearer review-secret'})=>({method:body?'POST':'GET',query:{org:'phm',action},headers:{host:'preview.test',...headers,...(body?{'content-type':'application/json'}:{})},body});

test('archive is Preview-only, isolated by tool name and rejects unsafe image references',()=>{
  assert.equal(PHOTO_ARCHIVE_TOOL,'photo-archive-preview');assert.equal(photoArchiveEnabled({...env,VERCEL_ENV:'production'}),false);
  assert.equal(photoArchiveEnabled({...env,VERCEL_GIT_COMMIT_REF:'other'}),false);
  assert.equal(flickrImage('https://evil.test/x'),null);assert.equal(flickrImage('https://user@live.staticflickr.com/x'),null);
});
test('import stores actual IDs and minimal refs, keeps AI suggestions unconfirmed and preserves decisions on refresh',async()=>{
  const {service,store}=fixture();const imported=await service.importCase('PHM',game,0);
  assert.equal(imported.stats.total,2);assert.equal(imported.stats.confirmed,0);assert.equal(imported.state.photos[1].previewUrl,null);
  assert.equal(imported.state.photos[0].suggestions[0].candidates.length,2);assert.deepEqual(await service.archive('PHM'),[]);
  await service.decide('PHM',decision(1),'operations:PHM');const refreshed=await service.importCase('PHM',game,2);
  assert.equal(refreshed.stats.confirmed,1);assert.equal(refreshed.state.reviews['55635051690'].players[0].playerId,a);
  const reopened=createPhotoArchive({env,store,readCases:async()=>cases});assert.equal((await reopened.archive('PHM'))[0].photos.length,1);
});
test('one photo can be assigned to multiple players; stable ID groups photos despite jersey/team changes across matches',async()=>{
  const {service}=fixture();await service.importCase('PHM',game,0);await service.importCase('PHM',game2,0);
  await service.decide('PHM',decision(1,{playerIds:[a,b]}),'operations:PHM');
  await service.decide('PHM',decision(1,{gameId:game2,photoId:'55633060430'}),'operations:PHM');
  const archive=await service.archive('PHM');assert.equal(archive.length,2);assert.equal(archive.find(p=>p.playerId===a).photos.length,2);
  assert.deepEqual(archive.find(p=>p.playerId===a).photos.map(p=>p.jerseyNumber),['22','17']);
  await service.decide('PHM',decision(2,{decision:'reject',playerIds:[]}),'operations:PHM');
  assert.equal((await service.archive('PHM')).length,1);assert.equal((await service.archive('PHM'))[0].photos.length,1);
});
test('CAS conflicts and foreign photo/player/game/org references cannot overwrite another review',async()=>{
  const {service,store}=fixture();await service.importCase('PHM',game,0);await service.decide('PHM',decision(1),'operations:PHM');
  const count=store.writes;
  await assert.rejects(service.decide('PHM',decision(1,{playerIds:[b]}),'operations:PHM'),e=>e.status===409);
  for(const extra of [{playerIds:['unknown']},{playerIds:[a,a]},{photoId:'not-in-game'},{reviewer:''}])await assert.rejects(service.decide('PHM',decision(2,extra),'operations:PHM'));
  await assert.rejects(service.importCase('EUCHL',game,0),e=>e.status===404);await assert.rejects(service.read('PHM','unknown'),e=>e.status===404);
  assert.equal(store.writes,count);assert.equal((await service.archive('PHM'))[0].playerId,a);
});
test('reset removes confirmed links and records the previous assignment in bounded audit',async()=>{
  const {service}=fixture();await service.importCase('PHM',game,0);await service.decide('PHM',decision(1),'operations:PHM');
  const reset=await service.decide('PHM',decision(2,{decision:'reset',playerIds:[]}),'operations:PHM');
  assert.equal(reset.stats.confirmed,0);assert.equal(reset.state.reviews['55635051690'].status,'pending');
  assert.deepEqual(reset.state.audit.at(-1).previousPlayerIds,[a]);assert.deepEqual(await service.archive('PHM'),[]);
});
test('HTTP protects reads and writes before touching source/storage; accepts Operations cookie, blocks foreign origins',async()=>{
  let reads=0;const service={ready:true,catalog:async()=>{reads++;return [];}},handler=createPhotoArchiveHandler({env,service});
  const denied=response();await handler(request('catalog',null,{}),denied);assert.equal(denied.code,401);assert.equal(reads,0);
  const otherOrg=response();await handler({...request('catalog'),query:{org:'euchl',action:'catalog'}},otherOrg);assert.equal(otherOrg.code,404);
  const foreign=response();await handler(request('import',{gameId:game,revision:0},{authorization:'Bearer review-secret',origin:'https://other.test'}),foreign);assert.equal(foreign.code,403);
  const cookie=sessionCookie({code:'PHM'},'review-secret').split(';')[0],allowed=response();
  await handler(request('catalog',null,{cookie}),allowed);assert.equal(allowed.code,200);assert.equal(reads,1);
  const prod=response();await createPhotoArchiveHandler({env:{...env,VERCEL_ENV:'production'},service})(request('catalog'),prod);assert.equal(prod.code,503);
});
test('authenticated decisions persist; future picker projection exposes only confirmed photo references',async()=>{
  const {service}=fixture();await service.importCase('PHM',game,0);const handler=createPhotoArchiveHandler({env,service});
  const saved=response();await handler(request('decide',decision(1)),saved);assert.equal(saved.code,200);assert.equal(saved.body.stats.confirmed,1);
  const projection=response();await handler({...request('player-photos'),query:{org:'phm',action:'player-photos',playerId:a}},projection);
  assert.equal(projection.code,200);assert.equal(projection.body.photos.length,1);assert.doesNotMatch(JSON.stringify(projection.body),/Tester|Hráč vlevo|review-secret/);
  const missing=response();await handler(request('decide',{...decision(2),playerIds:['other']}),missing);assert.equal(missing.code,400);
});
test('missing durable storage cannot report a successful save',async()=>{
  const service=createPhotoArchive({env,readCases:async()=>cases});assert.equal(service.ready,false);
  await assert.rejects(service.importCase('PHM',game,0),e=>e.status===503);
});
test('in-progress selections persist but enter the player archive only after explicit closure',async()=>{
  const {service,store}=fixture();await service.importCase('PHM',game,0);let v=await service.decide('PHM',decision(1,{decision:'draft'}),'operations:PHM');
  assert.equal(v.stats.inProgress,1);assert.equal(v.stats.confirmed,0);assert.deepEqual(await service.archive('PHM'),[]);
  const reopened=createPhotoArchive({env,store,readCases:async()=>cases});assert.equal((await reopened.read('PHM',game)).state.reviews['55635051690'].players[0].playerId,a);
  v=await reopened.decide('PHM',decision(v.revision),'operations:PHM');assert.equal(v.stats.inProgress,0);assert.equal((await reopened.archive('PHM')).length,1);
  v=await reopened.decide('PHM',decision(v.revision,{decision:'draft',playerIds:[]}),'operations:PHM');assert.equal(v.stats.inProgress,1);assert.deepEqual(await reopened.archive('PHM'),[]);
});
test('local app and API routes are served through the existing function without adding a serverless function',async()=>{
  if(!server.listening)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(base+'/photo-archive');assert.equal(page.status,200);assert.match(await page.text(),/Hledat hráče/);
    const alias=await fetch(base+'/control/apps/photo-archive');assert.equal(alias.status,200);
    const script=await fetch(base+'/photo-archive/app.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);
    const api=await fetch(base+'/api/photo-archive?action=access&org=phm');assert.equal(api.status,503); // local process has no explicit pilot opt-in
  }finally{await new Promise(resolve=>server.close(resolve));}
});
