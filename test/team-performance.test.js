import test from 'node:test';
import assert from 'node:assert/strict';
import {formIndex,teamRosterTrend,teamSpecialTeams,assignTeamRatings} from '../src/domain/team-performance.js';
import {comparisonMeetings,compareTeams,loadComparisonMeetings} from '../src/app/team-comparison.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const home=id(1),away=id(2),scope={organizationId:id(3),seasonId:id(4),groupId:id(5),phaseId:id(6)};
function game(n,players){return {game_id:id(n+10),organization_id:scope.organizationId,season_id:scope.seasonId,group_id:scope.groupId,phase_id:scope.phaseId,status:'FINISHED',played_on:`2026-10-${String(n+1).padStart(2,'0')}`,home_team_id:home,away_team_id:away,home_team_name:'Home',away_team_name:'Away',home_score:1,away_score:0,event_snapshot:{version:1,clockBasis:'game-elapsed',roster:[...players.map(p=>({id:id(p+100),teamId:home,isGoalie:false})),{id:id(500),teamId:home,isGoalie:true}],collections:{goals:true,penalties:true},events:[{id:id(900+n),type:'penalty',teamId:away,period:1,clockSeconds:0,penaltyMinutes:2},{id:id(800+n),type:'goal',teamId:home,period:1,clockSeconds:60}]}};}
test('form index explains 73%, handles zero wins, and never invents a value without matches',()=>{
 assert.equal(formIndex(['W','W','W','D','D'].map(result=>({result}))),73);assert.equal(formIndex([{result:'L'}]),0);assert.equal(formIndex([]),null);
});
test('roster trends exclude goalies and count scoreless starters; similarity is symmetric and missing games break adjacent pairs',()=>{
 const first=game(0,Array.from({length:10},(_,i)=>i)),second=game(1,[0,1,...Array.from({length:8},(_,i)=>i+10)]),r=teamRosterTrend([second,first],home);
 assert.deepEqual(r.series.map(g=>g.skaters),[10,10]);assert.equal(r.stability,20);assert.equal(r.unique,18);assert.equal(r.average,10);assert.equal(r.stabilityComplete,true);assert.equal(r.series[0].result,'W');
 const same=teamRosterTrend([first,{...first,game_id:id(77),played_on:'2026-10-03'}],home);assert.equal(same.stability,100);
 const missing=game(2,[]);delete missing.event_snapshot.roster;const partial=teamRosterTrend([first,missing,{...second,played_on:'2026-10-04'}],home);assert.equal(partial.pairs,0);assert.equal(partial.stability,null);assert.equal(partial.unique,18);assert.equal(partial.complete,false);assert.equal(partial.series[1].skaters,null);
 const legacy={...first,event_snapshot:null,skaters:[{id:id(100),teamId:home},{id:id(101),teamId:home}]};assert.equal(teamRosterTrend([legacy],home).series[0].skaters,2);
});
test('shared special-team aggregation weights opportunities and suppresses unsupported/incomplete periods',()=>{
 const a=game(0,[1]),b=game(1,[1]);b.home_score=0;b.event_snapshot.events=b.event_snapshot.events.filter(e=>e.type!=='goal');
 const result=teamSpecialTeams([a,b],home);assert.equal(result.available,true);assert.equal(result.ppPercentage,50);assert.equal(result.opportunities,2);assert.equal(teamSpecialTeams([a,b],away).pkPercentage,50);
 assert.equal(teamSpecialTeams([a],home,{complete:false,expected:2}).ppPercentage,null);
 const unsupported=game(2,[1]);unsupported.event_snapshot.events[0].penaltyMinutes=5;assert.equal(teamSpecialTeams([a,unsupported],home).available,false);
 const zero=game(3,[1]);zero.home_score=0;zero.event_snapshot.events=[];assert.equal(teamSpecialTeams([zero],home).ppPercentage,null);assert.equal(teamSpecialTeams([zero],home).available,true);
});
test('star ratings compare peers in the same scope, share ties, preserve unknowns and use weighted goalie saves',()=>{
 const teams=[{games:5,points:10,offense:4,defense:1,formRating:100,goalies:[{saves:90,ga:10},{saves:1,ga:9}]},{games:5,points:0,offense:1,defense:4,formRating:0,goalies:[]}];assignTeamRatings(teams);assert.equal(teams[0].rating.score,100);assert.equal(teams[1].rating.score,0);assert.equal(teams[0].rating.goalies,100*91/110);assert.equal(teams[1].rating.goalies,null);
 const ties=teams.map(t=>({...t,points:5,offense:2,defense:2,formRating:50}));assignTeamRatings(ties);assert.deepEqual(ties.map(t=>t.rating.score),[50,50]);ties[0].formRating=null;assignTeamRatings(ties);assert.equal(ties[0].rating.score,null);
});
test('discipline uses PIM per game and defender lists use recorded roles rather than point estimates',()=>{
 const rows=[{TeamId:home,'Team Name':'Home','Total Games':2,'Total Points':2,Wins:1,Draws:0,Losses:1,Score:'2:2','Total Penalty Minutes':4},{TeamId:away,'Team Name':'Away','Total Games':4,'Total Points':2,Wins:1,Draws:0,Losses:3,Score:'2:4','Total Penalty Minutes':6}];
 const first=game(0,[1]);first.event_snapshot.roster[0].position='D';const d=compareTeams({standings:rows,players:[{PlayerId:id(101),TeamId:home,FirstName:'Defender',GP:1,G:0,A:0}],goalies:null},[first],scope);assert.equal(d.teams[1].metrics.pimPerGame.rank,1);assert.equal(d.teams[0].metrics.pimPerGame.rank,2);assert.equal(d.teams[0].defenders[0].name,'Defender');
});
test('season meetings allow another phase but reject another organization or season, and bind the selected teams',async()=>{
 const teams=[{id:home},{id:away}],g=game(0,[1]);g.phase_id=id(999);assert.equal(comparisonMeetings([g],scope,teams).length,1);assert.throws(()=>comparisonMeetings([{...g,season_id:id(999)}],scope,teams));assert.throws(()=>comparisonMeetings([{...g,away_team_id:id(999)}],scope,teams));
 await loadComparisonMeetings({id:scope.organizationId},scope,teams,{sql:{query:async(query,values)=>{assert.match(query,/season_id=\$2/);assert.deepEqual(values,[scope.organizationId,scope.seasonId,[home,away]]);return [];}}});
});
