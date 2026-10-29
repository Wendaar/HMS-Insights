import test from 'node:test';
import assert from 'node:assert/strict';
import {pointRanks,assignComparisonBadges} from '../src/domain/player-rankings.js';
import {playerCard} from '../src/app/player-card.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const scope={seasonId:id(1),groupId:id(2),phaseId:id(3)};
const skater=(n,points,goals,gp=1)=>({id:id(n),points,goals,assists:points-goals,gp});
test('shared scoring ranks preserve Game Report P/G tie-break and competition ties',()=>{
 const players=[skater(10,7,3),skater(11,5,3),skater(12,5,3),skater(13,5,2)];
 const ranks=pointRanks(players);assert.deepEqual(players.map(p=>ranks.get(p.id)),[1,2,2,4]);
 const raw=players.map(p=>({PlayerId:p.id,FirstName:'Test',LastName:p.id,Team:'Test team',GP:p.gp,G:p.goals,A:p.assists}));
 for(const p of players)assert.equal(playerCard(raw,p.id,{}).rank,ranks.get(p.id));
});
test('transfer totals create one skater rank across teams, without summing different phases',()=>{
 const teams=[{id:id(20),players:[skater(10,5,2),skater(11,5,3)],goalies:[]},{id:id(21),players:[skater(10,2,1),skater(12,5,3)],goalies:[]}];
 const meta=assignComparisonBadges(teams,scope);assert.deepEqual(meta.scope,scope);assert.equal(meta.pointsTieBreak,'goals');
 for(const team of teams)assert.equal(team.players.find(p=>p.id===id(10)).badges.find(b=>b.metric==='points').rank,1);
 assert.equal(teams[0].players[1].badges.find(b=>b.metric==='points').rank,2);
 const raw=teams.flatMap(t=>t.players.map(p=>({PlayerId:p.id,FirstName:'Test',LastName:p.id,Team:t.id,GP:p.gp,G:p.goals,A:p.assists})));
 assert.equal(playerCard(raw,id(10),{}).rank,1);assert.equal(playerCard(raw,id(11),{}).rank,2);
 const separate=[{id:id(20),players:[skater(10,1,1),skater(11,2,2)],goalies:[]}];assignComparisonBadges(separate,{...scope,phaseId:id(99)});assert.equal(separate[0].players[0].badges.find(b=>b.metric==='points').rank,2);
});
test('top ten cutoff and leaders are based on the full active division table',()=>{
 const players=Array.from({length:12},(_,i)=>skater(100+i,12-i,12-i));players.push(skater(300,0,0,0));
 assignComparisonBadges([{id:id(20),players,goalies:[]}],scope);
 assert.equal(players[0].badges.find(b=>b.metric==='points').leader,true);assert.equal(players[9].badges.find(b=>b.metric==='points').rank,10);assert.deepEqual(players[10].badges,[]);assert.deepEqual(players[12].badges,[]);
});
test('missing offensive values suppress rankings rather than creating fabricated leaders',()=>{
 const team={id:id(20),players:[skater(10,9,3),{...skater(11,8,2),assists:null}],goalies:[]};
 assert.equal(assignComparisonBadges([team],scope).pointsComplete,false);assert.deepEqual(team.players[0].badges,[]);
 team.players[1].assists=6;assignComparisonBadges([team],scope,{playersAvailable:false});assert.deepEqual(team.players[0].badges,[]);
});
test('goalie badges respect GAA direction, save percentage direction, ties, minimum starts and unknowns',()=>{
 const goalies=[{id:id(40),gp:1,gaa:1,sv:90},{id:id(41),gp:2,gaa:1,sv:95},{id:id(42),gp:2,gaa:3,sv:80},{id:id(43),gp:0,gaa:0,sv:100},{id:id(44),gp:1,gaa:null,sv:null}];
 const meta=assignComparisonBadges([{id:id(20),players:[],goalies}],scope);assert.equal(meta.minGames,1);assert.equal(meta.goalieBasis,'player-team-record');
 assert.deepEqual(goalies.slice(0,3).map(p=>p.badges.find(b=>b.metric==='gaa').rank),[1,1,3]);assert.deepEqual(goalies.slice(0,3).map(p=>p.badges.find(b=>b.metric==='sv').rank),[2,1,3]);assert.deepEqual(goalies[3].badges,[]);assert.deepEqual(goalies[4].badges,[]);
});
