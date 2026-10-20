import test from 'node:test';
import assert from 'node:assert/strict';
import { goalMarks,rinkZones,netZones,teamPalette,rinkSvg,miniGoalMaps,unknownGoals } from '../public/game-report-graphics.js';
import { playerCard,getPlayerCard } from '../src/app/player-card.js';
import { createPlayerCardHandler } from '../src/web/player-card-handler.js';
import { loadPlayerSeasonRecords } from '../src/infrastructure/postgres-repository.js';
import { applySpecialTeams } from '../src/domain/special-teams.js';
const home='11111111-1111-4111-8111-111111111111',away='22222222-2222-4222-8222-222222222222',player='33333333-3333-4333-8333-333333333333';
const goal=(i,zone='left-circle',teamId=home)=>({type:'goal',id:`g-${i}`,teamId,clock:'1:00',clockSeconds:60+i,player:{id:player,name:'Střelec'},details:{shotZone:{code:zone,label:'Levý kruh'},netZone:{code:'five-hole',label:'Mezi betony'}}});
function summary(events){return {home:{id:home,name:'Domácí',color:'#008d9f'},away:{id:away,name:'Hosté',color:'#9c428f'},timeline:{events}};}
test('symbolic goal marks stay in source zones, are stable on reload and do not overlap for three goals',()=>{
  const events=[goal(1),goal(2),goal(3,'left-circle',away)];
  const marks=goalMarks(events,'shotZone');
  assert.equal(marks.length,3);assert.deepEqual(marks,goalMarks(events,'shotZone'));
  const [x,y,w,h]=rinkZones['left-circle'];
  for(const m of marks){assert.ok(m.x>=x&&m.x<=x+w);assert.ok(m.y>=y&&m.y<=y+h);}
  assert.ok(Math.hypot(marks[0].x-marks[1].x,marks[0].y-marks[1].y)>23);
  assert.equal(new Set(marks.map(m=>m.teamId)).size,2);
});
test('four goals in front of the net cluster by team; missing zones stay off the ice',()=>{
  const events=[...Array.from({length:4},(_,i)=>goal(i,'between-circles')),goal(5,null),goal(6,'between-circles',away)];
  const marks=goalMarks(events,'shotZone');
  assert.equal(marks.length,2);assert.equal(marks[0].events.length,4);
  assert.match(unknownGoals(summary(events),events,'shotZone'),/Neurčeno/);
  assert.match(unknownGoals(summary(events),events,'shotZone'),/data-event-id="g-5"/);
  assert.equal(goalMarks(events,'netZone').flatMap(m=>m.events).length,6);
});
test('goal graphics safely escape event text and reject arbitrary color markup',()=>{
  const events=[goal(1)];events[0].player.name='</title><script>alert(1)</script>';
  const s=summary(events);s.home.color='red" onload="alert(1)';
  assert.equal(teamPalette(s)[home],'#008d9f');
  const svg=rinkSvg(s,events);assert.doesNotMatch(svg,/<script|onload=/);assert.match(svg,/&lt;script&gt;/);
  assert.match(miniGoalMaps(s,events[0]),/mini-map/);
  assert.equal(miniGoalMaps(s,{details:{}}),'');
});
test('empty goal type defaults to 5 on 5 only with a usable penalty log; active penalty yields 5 on 4 or 4 on 5',()=>{
  const options={consistent:true,ordered:true,penaltiesAvailable:true,homeId:home,awayId:away};
  const events=[goal(1)];applySpecialTeams(events,options);
  assert.deepEqual(events[0].situation.manpower,{for:5,against:5});assert.equal(events[0].situation.basis,'no-active-penalty');
  const p={id:'p',type:'penalty',teamId:away,clockSeconds:30,penaltyMinutes:2};
  const pp=[p,goal(1)];applySpecialTeams(pp,options);assert.deepEqual(pp[1].situation.manpower,{for:5,against:4});
  const sh=[p,goal(1,'left-circle',away)];applySpecialTeams(sh,options);assert.deepEqual(sh[1].situation.manpower,{for:4,against:5});
  const missing=[goal(1)];applySpecialTeams(missing,{...options,penaltiesAvailable:false});assert.equal(missing[0].situation.code,'UNKNOWN');
});
test('HMS player cards sum transfers, rank tied scorers and expose only sporting fields',()=>{
  const rows=[{PlayerId:player,FirstName:'Test',LastName:'Hráč',GP:2,G:3,A:2,PIM:1.75,email:'private'},
    {PlayerId:player,GP:1,G:1,A:2,PIM:2},{PlayerId:home,GP:3,G:4,A:4},{PlayerId:away,GP:2,G:1,A:0}];
  const card=playerCard(rows,player,{competition_name:'PHM',season_name:'2026',group_name:'SUPER'});
  assert.equal(card.stats.P,8);assert.equal(card.stats.GP,3);assert.equal(card.rank,1);assert.equal(card.stats.PIM,3.75);
  assert.doesNotMatch(JSON.stringify(card),/email|private/);
  const keeper=playerCard([{PlayerId:player,GP:2,Svs:19,GA:5,W:1,SO:0}],player,{}, {role:'goalie'});
  assert.equal(keeper.stats.SvP,79.17);assert.equal(keeper.rank,null);
});
test('player card fetch is scoped to stored group, credential-free and does not fetch players outside this game',async()=>{
  const snapshot={game:{group_id:away},players:[{player_id:player}],goalies:[]};let calls=0;
  const options={loadSnapshot:async()=>snapshot,loadRecords:async()=>{throw Error('unexpected fallback');},fetchImpl:async(url,init)=>{
    calls++;assert.equal(new URL(url).searchParams.get('groupId'),away);assert.equal(init.headers.authorization,undefined);
    return {ok:true,json:async()=>[{PlayerId:player,GP:1,G:1,A:0}]};
  }};
  assert.equal((await getPlayerCard(home,player,options)).source,'hms');
  assert.equal(await getPlayerCard(home,home,options),null);assert.equal(calls,1);
  assert.equal((await getPlayerCard(home,player,{...options,fetchImpl:async()=>{throw Error('offline');},loadRecords:async()=>[{PlayerId:player,GP:1,G:1,A:1}]})).source,'imported-games');
});
test('player card handler validates IDs and hides storage errors',async()=>{
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(b){this.body=b;}});
  let r=response();await createPlayerCardHandler()({method:'GET',query:{gameId:'bad',playerId:player}},r);assert.equal(r.code,400);
  r=response();await createPlayerCardHandler({loadCard:async()=>{throw Error('DATABASE_URL=private');}})({method:'GET',query:{gameId:home,playerId:player}},r);assert.equal(r.code,503);assert.doesNotMatch(JSON.stringify(r.body),/private/);
});
test('local league fallback uses parameterized group/season and Prague date without mutating data',async()=>{
  await loadPlayerSeasonRecords(home,'skater',{sql:{query:async(sql,values)=>{assert.deepEqual(values,[home]);assert.match(sql,/season_id=s.season_id/);assert.match(sql,/Europe\/Prague/);assert.doesNotMatch(sql,/insert|delete|update|11111111/i);return [];}}});
});
