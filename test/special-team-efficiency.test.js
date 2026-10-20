import test from 'node:test';
import assert from 'node:assert/strict';
import { specialTeamTotals } from '../src/domain/special-teams.js';
import { renderSpecialTeams } from '../src/web/game-report-interactive.js';
const options={homeId:'home',awayId:'away',consistent:true,ordered:true,penaltiesAvailable:true};
const penalty=(teamId,t,id)=>({id,type:'penalty',teamId,clockSeconds:t,penaltyMinutes:2});
const goal=(teamId,t,id)=>({id,type:'goal',teamId,clockSeconds:t,details:{}});
test('team PP / PK denominators, goals and percentages mirror the opponent',()=>{
  const events=[];
  for(let i=0;i<11;i++){
    const penalized=i<5?'away':'home',scorer=penalized==='away'?'home':'away';
    events.push(penalty(penalized,i*200,`p${i}`));
    if(i<3||(i>=5&&i<7))events.push(goal(scorer,i*200+20,`g${i}`));
  }
  const result=specialTeamTotals(events,options);
  assert.equal(result.available,true);
  assert.equal(result.teams.home.PP,3);assert.equal(result.teams.home.opportunities,5);
  assert.equal(result.teams.away.PP,2);assert.equal(result.teams.away.opportunities,6);
  assert.equal(result.teams.home.ppPercentage,60);
  assert.ok(Math.abs(result.teams.home.pkPercentage-100*4/6)<1e-10);
  assert.equal(result.teams.away.pkPercentage,40);
  assert.equal(events[1].situation,undefined,'read model does not mutate input');
});
test('SH goals do not end a PP; subsequent PP goal ends it, not the opportunity count',()=>{
  const result=specialTeamTotals([penalty('home',0,'p'),goal('home',20,'sh'),goal('away',30,'pp'),goal('away',40,'ev')],options);
  assert.equal(result.teams.home.SH,1);assert.equal(result.teams.away.PP,1);
  assert.equal(result.teams.away.EV,1);assert.equal(result.teams.away.opportunities,1);
});
test('coincidental penalties do not create chances; zero chances has no percentage',()=>{
  const result=specialTeamTotals([penalty('home',0,'p'),penalty('away',0,'q'),goal('home',20,'g')],options);
  assert.equal(result.available,true);assert.equal(result.teams.home.opportunities,0);
  assert.equal(result.teams.home.ppPercentage,null);assert.equal(result.teams.home.pkPercentage,null);
});
test('incomplete logs, overlaps, major penalties and ambiguous goal ties suppress denominators',()=>{
  for(const [events,opts] of [
    [[],{...options,penaltiesAvailable:false}],
    [[penalty('home',0,'p'),penalty('home',30,'q')],options],
    [[{...penalty('home',0,'p'),penaltyMinutes:5}],options],
    [[penalty('home',20,'p'),goal('away',20,'g')],options],
  ]){const result=specialTeamTotals(events,opts);assert.equal(result.available,false);assert.equal(result.teams.home.ppPercentage,null);}
});
test('staggered opposing penalties create two advantage phases separated by equal strength',()=>{
  const result=specialTeamTotals([penalty('away',0,'p'),penalty('home',90,'q'),goal('away',130,'g')],options);
  assert.equal(result.available,true);assert.equal(result.teams.home.opportunities,1);assert.equal(result.teams.away.opportunities,1);
  assert.equal(result.teams.away.PP,1);assert.equal(result.teams.home.pkPercentage,0);
});
test('comparison keeps teams and goal detail actions clearly separate',()=>{
  const events=[penalty('away',0,'p'),goal('home',30,'g'),penalty('home',200,'q')];
  const s={home:{id:'home',name:'Team <A>'},away:{id:'away',name:'Team B'},timeline:{events,specialTeams:specialTeamTotals(events,options)}};
  const html=renderSpecialTeams(s);
  assert.match(html,/Team &lt;A&gt;/);assert.match(html,/100 %/);
  assert.match(html,/data-strength="PP" data-strength-team="home"/);
  assert.match(html,/comparison-track/);
});
