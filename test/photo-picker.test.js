import test from 'node:test';
import assert from 'node:assert/strict';
import {photoChoice,selectedPhotoUrl} from '../public/photo-picker/model.js';
import {validatePlayerPhotoChoices} from '../src/app/player-photo-choices.js';
import {createPhotoArchive} from '../src/app/photo-archive.js';
import {createPhotoArchiveHandler} from '../src/web/photo-archive-handler.js';
import {createArchiveDiscovery} from '../src/app/photo-archive-discovery.js';
import {sessionCookie} from '../src/security/operations-session.js';
import {broadcastPhotoChoices,applyBroadcastPhotos} from '../public/photo-picker/broadcast.js';
import {allStarsSettings,resolvedSelection} from '../src/app/all-stars.js';
import {channelState,createChannelHandler} from '../src/web/broadcast-channel.js';
import {fetchAlbum} from '../photo-archive/flickr.mjs';
const game='11111111-1111-4111-8111-111111111111',player='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',team='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',orgId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const url='https://live.staticflickr.com/1/123_abcd_b.jpg';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/hms-photo-archive-pilot',HMS_PHM_OPERATIONS_SECRET:'phm-secret',HMS_EUCHL_OPERATIONS_SECRET:'euchl-secret',HMS_EUCHL_ORGANIZATION_ID:orgId,HMS_EUCHL_API_TOKEN:'euchl-token'};
function memory(){const rows=new Map();return {rows,async get(org,id){return structuredClone(rows.get(org+id)||null);},async list(org){return [...rows.entries()].filter(([key])=>key.startsWith(org)).map(([key])=>({slug:key.slice(org.length)}));},async save(org,id,draft,revision){if((rows.get(org+id)?.revision||0)!==revision)return null;const row={draft:structuredClone(draft),revision:revision+1};rows.set(org+id,row);return structuredClone(row);}};}
const cases=['PHM','EUCHL'].map(org=>({org,gameId:game,flickrAlbum:'https://flic.kr/s/test'}));
const source=()=>({gameId:game,title:'Fixture',teams:[{teamId:team,name:'Team'}],players:[{playerId:player,teamId:team,name:'Player',jerseyNumber:'19'}],albumId:'1',albumTotal:1,photos:[{id:'123',previewUrl:url}]});
test('photo source priority defaults to HMS and rejects arbitrary URLs, SVG uploads and oversized content',()=>{
  const hms='https://hockeymanagementsystem.s3.amazonaws.com/test.jpg';assert.equal(selectedPhotoUrl(null,hms),hms);
  assert.equal(selectedPhotoUrl({source:'archive',photoId:'123',url},hms),url);
  assert.equal(photoChoice({source:'upload',url:'data:image/jpeg;base64,/9j/AAAA'}).source,'upload');
  for(const choice of [{source:'archive',photoId:'123',url:'https://evil.test/x'},{source:'upload',url:'data:image/svg+xml;base64,AAAA'},{source:'upload',url:'data:image/jpeg;base64,/9j/'+ 'A'.repeat(180000)}])assert.throws(()=>photoChoice(choice));
});
test('publication validates archive identity against exact player and organization, never only a URL',async()=>{
  const config={photoChoices:{[player+'|'+team]:{source:'archive',photoId:'123',url}}};let seen;
  await validatePlayerPhotoChoices('EUCHL',config,{playerPhotos:async(org,id)=>{seen=[org,id];return [{photos:[{id:'123',previewUrl:url}]}];}});assert.deepEqual(seen,['EUCHL',player]);
  await assert.rejects(validatePlayerPhotoChoices('PHM',config,{playerPhotos:async()=>[]}),TypeError);
});
test('organizations share neither assignments nor archives; partial photos prevent album closure',async()=>{
  const store=memory(),service=createPhotoArchive({env,store,readCases:async()=>cases,loadSource:source});
  await service.importCase('PHM',game,0);await service.importCase('EUCHL',game,0);
  await assert.rejects(service.reviewAlbum('PHM',{gameId:game,revision:1,status:'closed'},'fixture'),e=>e.status===422);
  let v=await service.decide('PHM',{gameId:game,photoId:'123',revision:1,decision:'assign',playerIds:[player],reviewer:'QA'},'fixture');
  assert.equal((await service.archive('PHM')).length,1);assert.deepEqual(await service.archive('EUCHL'),[]);
  v=await service.reviewAlbum('PHM',{gameId:game,revision:v.revision,status:'closed'},'fixture');assert.equal(v.state.albumStatus,'closed');
  v=await service.decide('PHM',{gameId:game,photoId:'123',revision:v.revision,decision:'reset',reviewer:'QA'},'fixture');assert.equal(v.state.albumStatus,'in_progress');
});
test('new photos reopen closed albums while preserving prior confirmed references',async()=>{
  const store=memory();let expanded=false;const service=createPhotoArchive({env,store,readCases:async()=>cases,loadSource:()=>{const s=source();if(expanded){s.photos.push({id:'124',previewUrl:url});s.albumTotal=2;}return s;}});
  let v=await service.importCase('PHM',game,0);v=await service.decide('PHM',{gameId:game,photoId:'123',revision:v.revision,decision:'assign',playerIds:[player],reviewer:'QA'},'QA');v=await service.reviewAlbum('PHM',{gameId:game,revision:v.revision,status:'closed'},'QA');expanded=true;
  v=await service.importCase('PHM',game,v.revision);assert.equal(v.state.albumStatus,'in_progress');assert.equal(v.state.hasNewPhotos,true);assert.equal(v.stats.confirmed,1);assert.equal(v.stats.pending,1);
});
test('PHM Operations cookie cannot authorize another organization; that organization has its own valid session',async()=>{
  let orgSeen;const handler=createPhotoArchiveHandler({env,service:{ready:true,catalog:async org=>{orgSeen=org;return [];}}});
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
  const req={method:'GET',query:{org:'euchl',action:'catalog'},headers:{cookie:sessionCookie({code:'PHM'},'phm-secret').split(';')[0]}};let r=response();await handler(req,r);assert.equal(r.code,401);assert.equal(orgSeen,undefined);
  r=response();await handler({...req,headers:{authorization:'Bearer euchl-secret'}},r);assert.equal(r.code,200);assert.equal(orgSeen,'EUCHL');
});
test('HMS discovery checks token ownership, keeps old catalog entries and rejects foreign games before storage',async()=>{
  const store=memory();let foreign=false;const discovery=createArchiveDiscovery({env,store,fetchImpl:async(u,init)=>{assert.equal(init.headers.authorization,'Bearer euchl-token');return Response.json([{gameId:game,organizationId:foreign?'wrong':orgId,startDate:'2026-11-05',flickrAlbum:'https://flic.kr/s/abc',HomeTeam:{name:'Home'},AwayTeam:{name:'Away'}}]);}});
  const r=await discovery.discover('EUCHL',{from:'2026-11-01',to:'2026-11-10'});assert.equal(r.albums,1);assert.equal((await store.get('EUCHL','catalog')).draft.items.length,1);assert.equal(await store.get('PHM','catalog'),null);
  foreign=true;await assert.rejects(discovery.discover('EUCHL',{from:'2026-11-01',to:'2026-11-10'}));assert.equal((await store.get('EUCHL','catalog')).revision,1);
});
test('All Stars preserves chosen photos through settings and resolved frozen lineup without mutating HMS portraits',()=>{
  const id=player+'|'+team,choice={source:'archive',photoId:'123',url},config=allStarsSettings({seasonId:game,month:'2026-10',groupId:orgId,title:'All Stars',selection:{F:[id],D:[],G:[]},photoChoices:{[id]:choice}},'PHM');
  const hms={id,playerId:player,imageUrl:'https://hockeymanagementsystem.s3.amazonaws.com/profile.jpg'};
  const selected=resolvedSelection(config,{candidates:{F:[hms],D:[],G:[]}});assert.deepEqual(selected.F[0].photoChoice,choice);assert.equal(hms.photoChoice,undefined);
  assert.throws(()=>allStarsSettings({...config,photoChoices:{foreign:choice}},'PHM'));
});
test('Broadcast photos override roster, scorer and insight consistently without modifying source facts',()=>{
  const choices=broadcastPhotoChoices({[player]:{source:'archive',photoId:'123',url}}),game={match:{roster:[{id:player,imageUrl:null}],goals:[{scorer:{id:player}}],insights:[{id:player}]}};
  const graphic=applyBroadcastPhotos(game,choices);assert.equal(graphic.match.roster[0].imageUrl,url);assert.equal(graphic.match.goals[0].scorer.imageUrl,url);assert.equal(graphic.match.insights[0].imageUrl,url);assert.equal(game.match.roster[0].imageUrl,null);
  assert.throws(()=>broadcastPhotoChoices({evil:{source:'hms'}}));
});
test('OBS channel stores and publicly returns only an explicitly chosen validated photo, protected by existing control key',async()=>{
  let row;const store={async create(id,hash,state){row={id,control_hash:hash,state,revision:1};return row;},async get(){return row;},async update(){return null;}};
  const handler=createChannelHandler({env,store,playerPhotos:async()=>[{photos:[{id:'123',previewUrl:url}]}]});
  const state={org:'EUCHL',gameId:game,lang:'cs',layer:'lineup',side:'home',period:'current',page:1,insight:'',visible:true,photoChoices:{[player]:{source:'archive',photoId:'123',url}}};
  assert.equal(channelState(state,env).photoChoices[player].url,url);
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
  let r=response();await handler({method:'POST',query:{channels:'1'},headers:{'content-type':'application/json'},body:{state}},r);assert.equal(r.code,201);assert.equal(r.body.state.photoChoices[player].url,url);
  r=response();await handler({method:'PATCH',query:{channel:row.id},headers:{'content-type':'application/json'},body:{state,revision:1}},r);assert.equal(r.code,403);
});
test('saved links remain usable when HMS omits albums; multimedia is read without credentials and checked against game identity',async()=>{
  let wrong=false;const detail={gameId:game,organizationId:orgId,startDate:'2026-11-05',homeTeamId:team,awayTeamId:player};
  const store=memory(),discovery=createArchiveDiscovery({env,store,fetchImpl:async(input,init)=>{
    const u=new URL(input);if(u.hostname==='api.prod.hms.wootera.net'){assert.equal(init.headers.authorization,undefined);if(u.pathname.endsWith('gameMultimedia'))return Response.json({albumUrl:'https://flic.kr/s/hmsalbum'});return Response.json({startDate:'2026-11-05',HomeTeam:{teamId:wrong?game:team},AwayTeam:{teamId:player}});}
    assert.equal(init.headers.authorization,'Bearer euchl-token');return Response.json(detail);
  }});
  let result=await discovery.context('EUCHL',game,'https://flic.kr/s/saved');assert.equal(result.albumSource,'hms');assert.equal(result.flickrAlbum,'https://flic.kr/s/hmsalbum');
  wrong=true;result=await discovery.context('EUCHL',game,'https://flic.kr/s/saved');assert.equal(result.albumSource,'saved-link');assert.equal(result.flickrAlbum,'https://flic.kr/s/saved');
});
test('manual album attachment verifies game organization and never writes to HMS or another catalog',async()=>{
  const store=memory();let foreign=false,calls=0;const service=createPhotoArchive({env,store,fetchImpl:async(input,init)=>{calls++;assert.equal(init.method || 'GET','GET');const u=new URL(input);if(u.hostname==='api.prod.hms.wootera.net')return new Response('',{status:404});return Response.json({gameId:game,organizationId:foreign?'wrong':orgId,startDate:'2026-11-05'});}});
  await assert.rejects(service.linkAlbum('EUCHL',{gameId:game,albumUrl:'https://evil.test'}),e=>e.status===400);assert.equal(calls,0);
  await service.linkAlbum('EUCHL',{gameId:game,albumUrl:'https://flic.kr/s/manual'});assert.equal((await store.get('EUCHL','catalog')).draft.items[0].source,'saved-link');assert.equal(await store.get('PHM','catalog'),null);
  foreign=true;await assert.rejects(service.linkAlbum('EUCHL',{gameId:game,albumUrl:'https://flic.kr/s/other'}));assert.equal((await store.get('EUCHL','catalog')).revision,1);
});
test('larger Flickr albums expose subsequent pages with bounded requests and preserve the true total',async()=>{
  const result=await fetchAlbum('https://www.flickr.com/photos/owner/albums/123',{limit:250,offset:250,env:{FLICKR_API_KEY:'fixture'},fetchImpl:async(input)=>{const u=new URL(input);assert.equal(u.searchParams.get('page'),'2');return Response.json({stat:'ok',photoset:{id:'123',total:300,photo:Array.from({length:50},(_,i)=>({id:String(251+i)}))}});}});
  assert.equal(result.photos.length,50);assert.equal(result.photos[0].id,'251');assert.equal(result.nextOffset,300);assert.equal(result.total,300);
});
test('refreshing a large closed album requires loading its current remaining pages before closing again',async()=>{
  const store=memory(),photos=Array.from({length:300},(_,i)=>({id:String(i+1),previewUrl:url}));
  const reviews=Object.fromEntries(photos.map(p=>[p.id,{status:'rejected',players:[]}]))
  await store.save('PHM',game,{...source(),org:'PHM',gameId:game,photos,albumId:'1',albumUrl:'https://flic.kr/s/test',albumTotal:300,reviews,albumStatus:'closed',flickrNextOffset:300},0);
  const service=createPhotoArchive({env,store,readCases:async()=>cases,loadSource:async(org,item)=>({...source(),photos:photos.slice(item.offset,item.offset+250),albumTotal:300,nextOffset:Math.min(300,item.offset+250)})});
  let v=await service.importCase('PHM',game,1);assert.equal(v.state.albumStatus,'in_progress');assert.equal(v.state.flickrNextOffset,250);
  await assert.rejects(service.reviewAlbum('PHM',{gameId:game,revision:v.revision,status:'closed'},'QA'),e=>e.status===422);
  v=await service.importCase('PHM',game,v.revision,'QA',250);v=await service.reviewAlbum('PHM',{gameId:game,revision:v.revision,status:'closed'},'QA');assert.equal(v.state.albumStatus,'closed');
});
