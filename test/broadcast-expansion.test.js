import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastLibrary} from '../src/domain/broadcast-library.js';
import {channelTables,channelState,createChannelHandler} from '../src/web/broadcast-channel.js';
import {broadcastContext,loadBroadcastHistory,summarizeBroadcastHistory} from '../src/app/broadcast-context.js';
import {eligibleAssets,renderExtraLayer} from '../public/broadcast/extra-layers.js';
import {renderMatchLayer} from '../public/broadcast/match-layers.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const asset={id:id(8),org:'EUCHL',kind:'cta',scope:'organization',targetId:'',enabled:true,title:'QR <title>',claim:'Claim',url:'https://example.com',image:png};
const detail={gameId:id(1),organizationId:id(2),startDate:'2026-10-24',startTime:'19:00',HomeTeam:{teamId:id(3)},AwayTeam:{teamId:id(4)},Season:{seasonId:id(5),name:'2026/27',Competition:{competitionId:id(6),name:'League'}}};
const row=(extra={})=>({game:{game_id:id(10),organization_id:id(2),season_id:id(5),competition_id:id(6),home_team_id:id(3),away_team_id:id(4),home_team_name:'Home',away_team_name:'Away',home_score:2,away_score:1,played_on:'2026-10-23',started_at:'19:00',status:'FINISHED',...extra},players:[{id:id(11),teamId:id(3),name:'Home Player',goals:2,assists:1,image:'https://evil.test/private.jpg'},{id:id(12),teamId:id(4),name:'Away Player',goals:1,assists:0}]});
test('preview channel storage is isolated, including missing environment; production table requires explicit production',()=>{
  assert.match(channelTables({VERCEL_ENV:'preview'}).channels,/_preview$/);assert.match(channelTables({}).library,/_preview$/);
  assert.equal(channelTables({VERCEL_ENV:'production'}).channels,'broadcast_channels');assert.match(channelTables({VERCEL_ENV:'production',BROADCAST_SANDBOX:'1'}).channels,/_preview$/);
});
test('library validates scoped sporting assets, raster signatures, HTTPS links, counts and budgets',()=>{
  assert.equal(broadcastLibrary([asset])[0].title,asset.title);
  for(const patch of [{image:'data:image/svg+xml;base64,PHN2Zz4='},{image:'data:image/png;base64,YmFk'},{url:'javascript:alert(1)'},{url:'https://user:password@example.com'},{scope:'team',targetId:'bad'},{kind:'script'},{org:'UNKNOWN'},{image:'x'.repeat(400000)}])assert.throws(()=>broadcastLibrary([{...asset,...patch}]));
  assert.throws(()=>broadcastLibrary([asset,asset]));assert.throws(()=>broadcastLibrary(Array.from({length:17},(_,i)=>({...asset,id:id(i+100)}))));
});
test('asset selection binds exact organization, game and selected team; disabled and foreign items never appear',()=>{
  const items=[asset,{...asset,id:id(9),scope:'team',targetId:id(3)},{...asset,id:id(10),scope:'game',targetId:id(1)},{...asset,id:id(11),scope:'team',targetId:id(4)},{...asset,id:id(12),org:'PHM'},{...asset,id:id(13),enabled:false}];
  assert.deepEqual(eligibleAssets(items,{org:'EUCHL',gameId:id(1),homeId:id(3),awayId:id(4),side:'home',kind:'cta'}).map(a=>a.id),[id(8),id(9),id(10)]);
});
test('library write needs private capability and independent revision; public reads never return keys',async()=>{
  let library={items:[],revision:0},hash;
  const store={create:async(id,h,state)=>{hash=h;return {id,state,revision:1};},get:async id=>({id,state:{},revision:1}),library:async()=>library,saveLibrary:async(id,h,revision,items)=>h===hash&&revision===library.revision?(library={items,revision:revision+1}):null};
  const env={HMS_EUCHL_API_TOKEN:'token',HMS_EUCHL_ORGANIZATION_ID:id(2)},handler=createChannelHandler({env,store});
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
  const state={org:'EUCHL',gameId:id(1),lang:'cs',layer:'cta',side:'home',period:'current',page:1,insight:'',visible:true,corner:'top-right',assetId:'',metric:'goals',rotateSeconds:5};
  assert.equal(channelState(state,env).corner,'top-right');assert.throws(()=>channelState({...state,rotateSeconds:1},env));
  const created=response();await handler({method:'POST',headers:{'content-type':'application/json'},query:{channels:'1'},body:{state}},created);assert.equal(created.code,201);
  const query={channel:created.body.id,library:'1'},headers={'content-type':'application/json'},body={items:[asset],revision:0};
  const denied=response();await handler({method:'PATCH',query,headers,body},denied);assert.equal(denied.code,403);
  const authorized={...headers,authorization:'Bearer '+created.body.controlKey};
  const saved=response();await handler({method:'PATCH',query,headers:authorized,body},saved);assert.equal(saved.code,200);assert.equal(saved.body.revision,1);
  const stale=response();await handler({method:'PATCH',query,headers:authorized,body},stale);assert.equal(stale.code,409);
  const publicRead=response();await handler({method:'GET',query,headers:{}},publicRead);assert.equal(publicRead.code,200);assert.equal(publicRead.body.items.length,1);assert.doesNotMatch(JSON.stringify(publicRead.body),/controlKey|control_hash|Bearer/);
});
test('team leaders and form use exact org/season/competition, exclude selected/future fixtures, preserve team membership and suppress unsupported percentages',()=>{
  const rows=[row(),row({organization_id:id(99)}),row({season_id:id(99)}),row({competition_id:id(99)}),row({game_id:detail.gameId}),row({played_on:'2026-10-25'}),row({played_on:detail.startDate,started_at:'20:00'})];
  const teams=summarizeBroadcastHistory(rows,detail);
  assert.equal(teams.home.games,1);assert.equal(teams.home.wins,1);assert.equal(teams.away.losses,1);
  assert.equal(teams.home.players.length,1);assert.equal(teams.home.players[0].points,3);assert.equal(teams.home.players[0].imageUrl,null);
  assert.equal(teams.home.specialTeams.available,false);assert.equal(teams.home.specialTeams.ppPercentage,null);
});
test('history SQL is read-only and parameterized with exact scope and a bounded result',async()=>{
  await loadBroadcastHistory(detail,{sql:{query:async(sql,values)=>{assert.match(sql,/g.organization_id=\$1::uuid AND g.season_id=\$2::uuid AND g.competition_id=\$3::uuid/);assert.match(sql,/LIMIT 500/);assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|email|phone/);assert.deepEqual(values.slice(0,4),[id(2),id(5),id(6),id(1)]);return [];}}});
});
test('same-day timestamps retain earlier fixtures and reliable complete penalties produce historical PP/PK',()=>{
  const g=row({played_on:'2026-10-24',started_at:'2026-10-24T17:00:00',home_score:1,away_score:0,event_snapshot:{version:1,clockBasis:'game-elapsed',collections:{goals:true,penalties:true},events:[
    {id:id(70),type:'penalty',teamId:id(4),period:1,clock:'0:00',clockSeconds:0,penaltyMinutes:2},
    {id:id(71),type:'goal',teamId:id(3),period:1,clock:'1:00',clockSeconds:60,player:{id:id(11),name:'Player'},assists:[]},
  ]}});
  const context=summarizeBroadcastHistory([g],detail);assert.equal(context.home.games,1);assert.equal(context.home.specialTeams.available,true);assert.equal(context.home.specialTeams.ppPercentage,100);assert.equal(context.away.specialTeams.pkPercentage,0);
  const incomplete=summarizeBroadcastHistory([g,row()],detail);assert.equal(incomplete.home.specialTeams.covered,1);assert.equal(incomplete.home.specialTeams.available,false);assert.equal(incomplete.home.specialTeams.ppPercentage,null);
});
test('context preserves partial availability and filters next matches to selected teams and after fixture',async()=>{
  const fixture={id:id(50),date:'2026-10-25',time:'19:00',home:{id:id(3),name:'Home'},away:{id:id(55),name:'Other'}};
  const context=await broadcastContext(detail,{loadHistory:async()=>[row()],loadNext:async()=>[fixture,{...fixture,id:id(51),date:'2026-10-23'},{...fixture,id:detail.gameId},{...fixture,id:id(52),home:{id:id(56)}}]});
  assert.equal(context.historyAvailable,true);assert.equal(context.next.home.length,1);assert.equal(context.next.away.length,0);
  const missing=await broadcastContext(detail,{loadHistory:async()=>{throw new Error('secret');},loadNext:async()=>{throw new Error('secret');}});assert.equal(missing.historyAvailable,false);assert.equal(missing.nextAvailable,false);assert.doesNotMatch(JSON.stringify(missing),/secret/);
});
test('new public layers escape labels, clearly identify imported coverage, render no management UI and keep team identity on every goal',()=>{
  const game={ID:id(1),homeId:id(3),awayId:id(4),'Home Team':'Home <script>','Away Team':'Away',homeLogo:'https://example.com/home.png',Date:'24. 10. 2026',Competition:'League',context:{historyAvailable:true,scope:{competition:'League',season:'2026/27'},teams:summarizeBroadcastHistory([row()],detail),nextAvailable:false}};
  for(const layer of ['cta','sponsors','powerplay','leaders','next','results']){
    const html=renderExtraLayer(game,{layer,org:'EUCHL',items:[asset],lang:'en'});assert.doesNotMatch(html,/<script>|<button|<input/);assert.match(html,/data-layer=/);
    if(layer==='leaders')assert.match(html,/Imported games before this fixture/);if(layer==='powerplay')assert.match(html,/Reliable calculation is unavailable/);
  }
  const html=renderMatchLayer({...game,match:{coverage:'matches-score',goals:[{side:'home',period:1,clock:'1:00',scorer:{name:'Player'},assists:[],scoreAfter:{home:1,away:0}}]}},{layer:'scoresheet',side:'both'});
  assert.match(html,/goal-team-logo/);assert.match(html,/goal-team-name/);assert.doesNotMatch(html,/<script>/);
});
