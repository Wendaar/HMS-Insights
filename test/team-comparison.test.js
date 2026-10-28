import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTeams,comparisonCatalog,readTeamComparison,loadComparisonGames,loadComparisonScope} from '../src/app/team-comparison.js';
import {readComparisonTables} from '../src/app/broadcast-league.js';
import {createTeamComparisonHandler} from '../src/web/team-comparison-handler.js';
import {server} from '../src/server.js';
import {readFile} from 'node:fs/promises';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const scope={organizationId:id(1),seasonId:id(2),groupId:id(3),phaseId:id(4)};
function fixtures(){return {standings:[{TeamId:id(10),'Team Name':'Test A','Team Name Short':'A','Total Games':1,'Total Points':2,Wins:1,Draws:0,Losses:0,Score:'3:1','Total Penalty Minutes':'2:30'},{TeamId:id(11),'Team Name':'Test B','Total Games':1,'Total Points':0,Wins:0,Draws:0,Losses:1,Score:'1:3'}],players:[{TeamId:id(10),PlayerId:id(20),FirstName:'Player',LastName:'A',GP:1,G:2,A:1},{TeamId:id(11),PlayerId:id(20),FirstName:'Player',LastName:'A',GP:1,G:1,A:0}],goalies:[{TeamId:id(10),PlayerId:id(21),FirstName:'Goalie',GP:1,W:1,SvP:95,GAA:1}]};}
function history(){return [{organization_id:scope.organizationId,season_id:scope.seasonId,group_id:scope.groupId,phase_id:scope.phaseId,game_id:id(30),status:'FINISHED',played_on:'2026-10-22',home_team_id:id(10),away_team_id:id(11),home_score:3,away_score:1,home_team_name:'Test A',away_team_name:'Test B'}];}
const env={HMS_PHM_ORGANIZATION_ID:id(1)},options={env,catalog:async()=>({items:[{seasonId:id(2),name:'Test season'}]}),loadScope:async()=>[{organization_id:id(1),season_id:id(2),group_id:id(3),group_name:'Division',phase_id:id(4),phase_name:'Regular season'}],loadMeetings:async()=>history(),loadGames:async()=>history(),loadTables:async()=>fixtures()};
test('comparison preserves official rank, scopes player transfers by team and treats missing numbers as unknown',()=>{
 const d=compareTeams(fixtures(),history(),scope,{minStarts:1});assert.equal(d.teams[0].rank,1);assert.equal(d.teams[1].rank,2);assert.equal(d.teams[0].pim,2.5);assert.equal(d.teams[1].pim,null);assert.equal(d.teams[0].core,1);assert.equal(d.teams[1].players[0].points,1);assert.equal(d.teams[0].players[0].points,3);assert.equal(d.teams[0].form[0].result,'W');assert.equal(d.teams[1].form[0].result,'L');assert.equal(d.teams[0].formRating,100);
 const partial=compareTeams({...fixtures(),players:null,goalies:null},[],scope,{minStarts:1});assert.equal(partial.teams[0].core,null);assert.equal(partial.teams[0].formRating,null);assert.deepEqual(partial.teams[0].form,[]);assert.equal(partial.playersAvailable,false);
 const stale=history();stale[0].home_score=4;assert.equal(compareTeams(fixtures(),stale,scope).teams[0].history.complete,false);
});
test('comparison rejects foreign season, phase and duplicate history; tied per-game metrics share rank',()=>{
 for(const key of ['organization_id','season_id','group_id','phase_id']){const rows=history();rows[0][key]=id(99);assert.throws(()=>compareTeams(fixtures(),rows,scope));}
 assert.throws(()=>compareTeams(fixtures(),[...history(),...history()],scope));
 const f=fixtures();f.standings[1].Score='3:1';assert.deepEqual(compareTeams(f,[],scope).teams.map(t=>t.metrics.offense.rank),[1,1]);
});
test('catalog and reader verify owned season and phase before contacting public statistics',async()=>{
 const q={seasonId:id(2),groupId:id(3),phaseId:id(4)};const value=await readTeamComparison('phm',q,options);assert.equal(value.phase.name,'Regular season');assert.equal(value.minStarts,null);
 for(const key of ['seasonId','groupId','phaseId']){let calls=0;await assert.rejects(()=>readTeamComparison('phm',{...q,[key]:id(99)},{...options,loadTables:async()=>{calls++;return fixtures();}}),TypeError);assert.equal(calls,0);}
 for(const minStarts of ['0','-1','201','1.5','abc'])await assert.rejects(()=>readTeamComparison('phm',{...q,minStarts},options),TypeError);
 await assert.rejects(()=>comparisonCatalog('phm',q,{...options,loadScope:async()=>[{...(await options.loadScope())[0],organization_id:id(99)}]}));
});
test('comparison queries bind organization, season, group and phase; fixed-host transport scopes all tables',async()=>{
 const calls=[],sql={query:async(text,values)=>{calls.push({text,values});return [];}};await loadComparisonScope({id:id(1)},id(2),{sql});await loadComparisonGames({id:id(1)},scope,{sql});assert.deepEqual(calls[1].values,[id(1),id(2),id(3),id(4)]);assert.match(calls[1].text,/LIMIT 5001/);
 const urls=[];await readComparisonTables(scope,{fetchImpl:async u=>{urls.push(new URL(u));return {ok:true,json:async()=>[]};}});assert.equal(urls.length,3);assert.ok(urls.every(u=>u.hostname==='api.prod.hms.wootera.net'&&(u.searchParams.get('phaseId')??u.searchParams.get('phaseIds'))===id(4)));
});
test('read-only API returns safe localized errors and does not accept publication or arbitrary organizations',async()=>{
 const handler=createTeamComparisonHandler(options),call=async(q,method='GET')=>{const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;}};await handler({method,query:{org:'phm',lang:'en',...q}},r);return r;};
 assert.equal((await call({action:'compare',seasonId:id(2),groupId:id(3),phaseId:id(4)})).code,200);assert.equal((await call({action:'compare',org:'unknown'})).code,404);assert.equal((await call({action:'publish'},'POST')).code,405);assert.equal((await call({action:'compare',seasonId:id(99)})).code,400);
});
test('comparison local and deployment routes use the existing function and support embedding only on public output',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base='http://127.0.0.1:'+server.address().port;for(const path of ['/control/apps/team-comparison','/team-comparison/phm','/team-comparison/app.js','/team-comparison/graphics.js'])assert.equal((await fetch(base+path)).status,200);const p=await fetch(base+'/team-comparison/euchl');assert.match(p.headers.get('content-security-policy'),/frame-ancestors \*/);const a=await fetch(base+'/control/apps/team-comparison');assert.match(a.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal((await fetch(base+'/api/team-comparison?action=organizations')).status,200);}finally{await new Promise(r=>server.close(r));}
 const d=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));assert.equal(d.rewrites.find(r=>r.source==='/api/team-comparison').destination,'/api/game-summary?view=team-comparison');
});
