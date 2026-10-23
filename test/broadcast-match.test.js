import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastMatch} from '../src/domain/broadcast-match.js';
import {gameEventsResponse,lineupResponse,ids} from '../src/fixtures/real-game-sanitized.js';
import {renderMatchLayer} from '../public/broadcast/match-layers.js';
import {viewUrl} from '../public/broadcast/hms-source.js';
const detail={...gameEventsResponse,gameId:ids.game,homeTeamId:ids.home,awayTeamId:ids.away,HomeTeamGoals:9,AwayTeamGoals:3};
test('live model agrees with the recorded score, counts points and exposes sporting lineup fields only',()=>{
  const match=broadcastMatch(detail,gameEventsResponse,lineupResponse);
  assert.equal(match.coverage,'matches-score');assert.equal(match.goals.length,12);assert.equal(match.roster.length,25);
  assert.ok(match.insights.some(p=>p.type==='multi-point'));assert.ok(match.insights.every(p=>p.points===p.goals+p.assists));
  assert.doesNotMatch(JSON.stringify(match),/email|birthDate|phone|token|address/);
  assert.equal(match.periods.reduce((s,p)=>s+p.home,0),9);
});
test('three credited goals produce a hat trick, with each assist counted at most once per goal',()=>{
  const first=gameEventsResponse.GameEventGoals.find(g=>g.scoredByTeamId===ids.home);
  const goals=Array.from({length:3},(_,i)=>({...first,gameEventGoalId:`goal-${i}`,assistedBy1PlayerId:null,assistedBy2PlayerId:null,AssistedBy1Player:null,AssistedBy2Player:null}));
  const match=broadcastMatch({...detail,HomeTeamGoals:3,AwayTeamGoals:0},{GameEventGoals:goals},lineupResponse);
  assert.equal(match.insights.length,1);assert.equal(match.insights[0].type,'hat-trick');assert.equal(match.insights[0].goals,3);
  const p=lineupResponse.Lineups.find(p=>p.teamId===ids.home&&p.playerId!==first.scoredByPlayerId);
  const assisted=broadcastMatch({...detail,HomeTeamGoals:1,AwayTeamGoals:0},{GameEventGoals:[{...first,assistedBy1PlayerId:p.playerId,assistedBy2PlayerId:p.playerId}]},lineupResponse);
  assert.equal(assisted.insights.length,0);
});
test('score overrides and missing period assignments suppress invented period summaries and achievements',()=>{
  const mismatch=broadcastMatch({...detail,HomeTeamGoals:10},gameEventsResponse,lineupResponse);
  assert.equal(mismatch.coverage,'score-mismatch');assert.deepEqual(mismatch.insights,[]);assert.deepEqual(mismatch.periods,[]);
  const goals=gameEventsResponse.GameEventGoals.map(g=>({...g,period:null}));
  const missing=broadcastMatch(detail,{GameEventGoals:goals},lineupResponse);
  assert.equal(missing.coverage,'matches-score');assert.deepEqual(missing.periods,[]);assert.ok(missing.goals.every(g=>g.scoreAfter===null));
});
test('foreign games, deleted goals and explicit empty collections never resurrect unrelated data',()=>{
  const foreign=broadcastMatch({...detail,GameEventGoals:undefined},{gameId:'foreign',GameEventGoals:gameEventsResponse.GameEventGoals},{...lineupResponse,gameId:'foreign'});
  assert.equal(foreign.coverage,'unavailable');assert.equal(foreign.roster.length,0);
  const empty=broadcastMatch(detail,{GameEventGoals:[]},lineupResponse);assert.equal(empty.goals.length,0);assert.equal(empty.coverage,'score-mismatch');
  const deleted=broadcastMatch(detail,{GameEventGoals:gameEventsResponse.GameEventGoals.map(g=>({...g,isDeleted:true}))},lineupResponse);
  assert.equal(deleted.goals.length,0);assert.deepEqual(deleted.insights,[]);
});
test('thin API events resolve names from the lineup and deduplicate identical goal IDs',()=>{
  const goals=gameEventsResponse.GameEventGoals.map(g=>({eventId:g.gameEventGoalId,type:'goal',period:g.period,gameTime:g.gameTime,scoredByTeamId:g.scoredByTeamId,scoredByPlayerId:g.scoredByPlayerId,assistedBy1PlayerId:g.assistedBy1PlayerId,assistedBy2PlayerId:g.assistedBy2PlayerId}));
  const match=broadcastMatch(detail,{events:[...goals,goals[0]]},lineupResponse);
  assert.equal(match.goals.length,12);assert.equal(match.coverage,'matches-score');assert.ok(match.goals.every(g=>g.scorer.name));
});
test('language and chosen layer are stable in independent OBS URLs; rendered names are escaped',()=>{
  const url=new URL(viewUrl('https://example.com/broadcast/index.html',{org:'EUCHL',gameId:ids.game,lang:'en',layer:'lineup',side:'away',page:2}));
  assert.equal(url.searchParams.get('lang'),'en');assert.equal(url.searchParams.get('side'),'away');assert.equal(url.searchParams.get('page'),'2');
  const html=renderMatchLayer({'Home Team':'<script>','Away Team':'Away',match:{roster:[{name:'<img onerror=x>',side:'home',number:12}],goals:[],insights:[]}},{lang:'en',layer:'lineup'});
  assert.match(html,/Lineup/);assert.match(html,/&lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<script>|<img onerror/);
});
