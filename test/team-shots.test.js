import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGameSummary} from '../src/domain/game-summary.js';
import {renderGameReport} from '../src/web/game-report.js';
const home='365a02a0-c4fb-11f1-8ad4-9967cdc84598',away='2992d0d0-ce27-11f1-a5f0-6320901b5ad5';
const homeKeeper='11111111-1111-4111-8111-111111111111',awayKeeper='22222222-2222-4222-8222-222222222222';
function match(){
  const saves=(teamId,keeper,n,prefix)=>Array.from({length:n},(_,i)=>({id:`${prefix}-${i}`,type:'save',teamId,player:{id:keeper}}));
  const goals=(teamId,keeper,n,prefix)=>Array.from({length:n},(_,i)=>({id:`${prefix}-${i}`,type:'goal',teamId,player:{name:'Scorer'},allowedBy:{id:keeper}}));
  return {game:{game_id:'6c02df50-ce27-11f1-a5f0-6320901b5ad5',home_team_id:home,away_team_id:away,home_team_name:'Prague Guardians',away_team_name:'Bratislava Capitals',home_score:2,away_score:8,competition_name:'European Union College Hockey League',status:'FINISHED',event_snapshot:{version:1,collections:{goals:true,saves:true,penalties:true},events:[...saves(home,homeKeeper,35,'home-save'),...saves(away,awayKeeper,8,'away-save'),...saves(away,null,9,'quick-save'),...goals(home,awayKeeper,2,'home-goal'),...goals(away,homeKeeper,8,'away-goal')]}},goalies:[{player_id:homeKeeper,player_name:'Ryder Gregga',team_id:home,saves:35,goals_against:8},{player_id:awayKeeper,player_name:'Brasco Cirillo',team_id:away,saves:8,goals_against:2}]};
}
test('EUCHL regression: all team saves give Guardians 19 shots and Bratislava 43, without reimport',()=>{
  const stored=match(),before=JSON.stringify(stored),summary=buildGameSummary(stored);
  assert.equal(summary.home.shotsOnGoal,19);
  assert.equal(summary.away.shotsOnGoal,43);
  assert.equal(summary.away.unassignedSaves,9);
  assert.equal(summary.home.unassignedSaves,0);
  assert.equal(JSON.stringify(stored),before);
  const page=renderGameReport(summary);
  assert.match(page,/19 recorded shots/);assert.match(page,/43 recorded shots/);
  assert.doesNotMatch(page,/10 recorded shots/);
  assert.match(page,/Includes 9 team saves assigned to the only recorded goaltender/);
});
test('single recorded goalie includes unassigned team saves with an explicit basis',()=>{
  const summary=buildGameSummary(match()),keeper=summary.goalies.find(p=>p.id===awayKeeper);
  assert.equal(keeper.saves,17);assert.equal(keeper.goalsAgainst,2);
  assert.equal(keeper.savePercentage,89.47);assert.equal(keeper.shotsAgainst,19);
  assert.equal(keeper.attributedSaves,8);assert.equal(keeper.inferredSaves,9);
  assert.equal(keeper.statisticsBasis,'single-goalie-team-saves');
  assert.equal(summary.goalies.find(p=>p.id===homeKeeper).savePercentage,81.4);
});
test('a second roster goalie prevents assigning team saves even if only one has recorded events',()=>{
  const stored=match();stored.game.event_snapshot.roster=[{id:awayKeeper,teamId:away,isGoalie:true},{id:'backup',teamId:away,isGoalie:true}];
  const summary=buildGameSummary(stored),keeper=summary.goalies.find(p=>p.id===awayKeeper);
  assert.equal(keeper.saves,8);assert.equal(keeper.savePercentage,null);
  assert.equal(keeper.statisticsBasis,'partial-recorded-events');
});
test('seven additional home saves are included independently for the sole home goalie',()=>{
  const stored=match();for(let i=0;i<7;i++)stored.game.event_snapshot.events.push({id:`home-quick-${i}`,type:'save',teamId:home,player:{id:null}});
  const summary=buildGameSummary(stored),keeper=summary.goalies.find(p=>p.id===homeKeeper);
  assert.equal(keeper.saves,42);assert.equal(keeper.inferredSaves,7);assert.equal(keeper.savePercentage,84);
  assert.equal(summary.away.shotsOnGoal,50);
});
test('missing save collection, unknown save team or mismatched goals suppress team shots',()=>{
  for(const change of [m=>m.game.event_snapshot.collections.saves=false,m=>m.game.event_snapshot.events[0].teamId=null,m=>m.game.home_score=3]){
    const stored=match();change(stored);const summary=buildGameSummary(stored);
    assert.equal(summary.home.shotsOnGoal,null);assert.equal(summary.away.shotsOnGoal,null);
    assert.doesNotMatch(renderGameReport(summary),/recorded shots|Recorded shots/);
  }
});
test('explicit zero saves still counts goals as shots; multiple goalies do not duplicate team totals',()=>{
  const stored=match();stored.game.event_snapshot.events=stored.game.event_snapshot.events.filter(e=>e.type!=='save');
  let summary=buildGameSummary(stored);
  assert.equal(summary.home.shotsOnGoal,2);assert.equal(summary.away.shotsOnGoal,8);
  const complete=match();for(const e of complete.game.event_snapshot.events)if(e.type==='save'&&e.teamId===away&&!e.player.id)e.player.id='backup';
  complete.goalies.push({player_id:'backup',player_name:'Backup goalie',team_id:away,saves:9,goals_against:0});
  summary=buildGameSummary(complete);
  assert.equal(summary.home.shotsOnGoal,19);assert.equal(summary.away.unassignedSaves,0);
  assert.equal(summary.goalies.find(p=>p.id===awayKeeper).savePercentage,80);
});
