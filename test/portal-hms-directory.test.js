import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {portalDirectory,validatePortalSeasons} from '../src/app/public-portal.js';
import {loadPortalHmsDirectory} from '../src/app/portal-hms-directory.js';
import {comparisonCatalog,readTeamComparison} from '../src/app/team-comparison.js';
import {readDirectoryTeams} from '../src/app/broadcast-league.js';
import {widgetContext} from '../src/app/widgets.js';
import {directorySourceMessage,teamPhaseNames} from '../public/league/presentation.js';
import {scopedEntities} from '../public/widgets/scope-options.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/yhg-prague-membership.json',import.meta.url)));
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const seasonId=fixture.competition.Seasons[0].seasonId.toLowerCase(),group=fixture.competition.Seasons[0].Groups[0],groupId=group.groupId.toLowerCase();
const phaseId=group.Phases.find(p=>p.name==='GROUP A').phaseId.toLowerCase();
const phaseRows=fixture.tables.find(t=>t.scope.phaseId===phaseId).rows;
const env={HMS_YHG_ORGANIZATION_ID:id(1)};
function options(){return {env,loadPortalDirectory:async()=>[],loadPortalSeasons:async()=>[],loadLeagues:async()=>[],fetchOrganization:async()=>({organizationId:id(1)}),fetchCompetitions:async()=>[structuredClone(fixture.competition)],readDirectoryTeams:async scope=>fixture.tables.find(t=>JSON.stringify(t.scope)===JSON.stringify(scope)).rows,loadScope:async()=>{throw Error('No imported scope allowed');}};}
const official=rows=>rows.map(t=>({TeamId:t.id,'Team Name':t.name,'Total Games':t.games,'Total Points':t.points,Score:t.score,Wins:0,Draws:0,Losses:0}));

test('recorded Prague hierarchy and exact team assignments work before imports',async()=>{
 const d=await portalDirectory('YHG',seasonId,options());
 assert.equal(d.source,'hms-live');assert.equal(d.teamCount,10);assert.equal(d.groups.length,1);assert.equal(d.groups[0].phases.length,3);
 for(const phase of d.groups[0].phases){const expected=fixture.tables.find(t=>t.scope.phaseId===phase.id).rows.map(t=>t.id).sort();assert.deepEqual([...phase.teamIds].sort(),expected);}
 const a=d.teams.filter(t=>t.phaseIds.includes(phaseId));assert.equal(a.length,5);
 assert.ok(a.every(t=>t.groupIds.includes(groupId)));assert.match(teamPhaseNames(a[0],d.groups).join(','),/GROUP A/);
 const scope=await comparisonCatalog('YHG',{seasonId},options());assert.equal(scope.source,'hms-live');assert.equal(scope.groups[0].phases.length,3);
 assert.match(directorySourceMessage(d,'en'),/directly from HMS/);
});

test('no-import comparison keeps official zeros but suppresses unsupported form and ratings',async()=>{
 const d=await readTeamComparison('YHG',{seasonId,groupId,phaseId},{...options(),loadGames:async()=>[],loadMeetings:async()=>[],loadTables:async()=>({standings:official(phaseRows),players:null,goalies:null})});
 assert.equal(d.teams.length,5);
 for(const t of d.teams){assert.equal(t.games,0);assert.equal(t.points,0);assert.equal(t.formRating,null);assert.deepEqual(t.form,[]);assert.equal(t.history.complete,false);assert.equal(t.offense,null);assert.equal(t.defense,null);assert.equal(t.pim,null);assert.equal(t.specialTeams.available,false);assert.equal(t.specialTeams.ppPercentage,null);assert.equal(t.starRating?.score??null,null);}
 const unavailable=await readTeamComparison('YHG',{seasonId,groupId,phaseId},{...options(),loadGames:async()=>[],loadMeetings:async()=>[],loadTables:async()=>({standings:null,players:null,goalies:null})});
 assert.equal(unavailable.teams.length,5);assert.ok(unavailable.teams.every(t=>t.games===null&&t.rank===null&&t.points===null));
 const partialRows=official(phaseRows);partialRows[0]['Total Games']=null;partialRows[0]['Total Points']=null;
 const partial=await readTeamComparison('YHG',{seasonId,groupId,phaseId},{...options(),loadGames:async()=>[],loadMeetings:async()=>[],loadTables:async()=>({standings:partialRows,players:null,goalies:null})});
 assert.equal(partial.teams[0].games,null);assert.equal(partial.teams[0].points,null);assert.equal(partial.teams[0].offense,null);
});

test('foreign organization and nested hierarchy IDs fail before team lookup',async()=>{
 let reads=0;
 await assert.rejects(portalDirectory('YHG',seasonId,{...options(),fetchOrganization:async()=>({organizationId:id(9)}),readDirectoryTeams:async()=>{reads++;return [];}}),/organization mismatch/);
 assert.equal(reads,0);
 for(const patch of ['group','phase']){
  const raw=structuredClone(fixture.competition);
  if(patch==='group')raw.Seasons[0].Groups[0].seasonId=id(99);else raw.Seasons[0].Groups[0].Phases[0].groupId=id(99);
  await assert.rejects(portalDirectory('YHG',seasonId,{...options(),fetchCompetitions:async()=>[raw],readDirectoryTeams:async()=>{reads++;return [];}}),/ownership/);
 }
 assert.equal(reads,0);
 let tables=0;
 await assert.rejects(readTeamComparison('YHG',{seasonId,groupId,phaseId:id(99)},{...options(),loadTables:async()=>{tables++;}}),TypeError);assert.equal(tables,0);
});

test('unavailable phase membership stays unknown and cannot accept arbitrary group teams',async()=>{
 const opts={...options(),readDirectoryTeams:async scope=>{if(scope.phaseId===phaseId)throw Error('offline');return options().readDirectoryTeams(scope);}};
 const directory=await portalDirectory('YHG',seasonId,opts),phase=directory.groups[0].phases.find(p=>p.id===phaseId);
 assert.equal(directory.membershipComplete,false);assert.equal(directory.teamCount,null);assert.equal(phase.teamsAvailable,false);assert.deepEqual(phase.teamIds,[]);
 assert.deepEqual(scopedEntities(directory,{phaseId}).teams,[]);
 assert.match(directorySourceMessage(directory,'en'),/temporarily unavailable/);
 const scope={seasonId,groupId,phaseId,teamId:phaseRows[0].id};
 await assert.rejects(widgetContext('YHG',scope,opts),TypeError);
 await assert.rejects(validatePortalSeasons('YHG',{seasonIds:[seasonId],defaultSeasonId:seasonId,widgets:[{scope}]},opts),TypeError);
});

test('membership transport is fixed-host, bounded and retains team identity without numeric stats',async()=>{
 const rows=await readDirectoryTeams({phaseId},{fetchImpl:async(url,init)=>{
  assert.equal(new URL(url).hostname,'api.prod.hms.wootera.net');assert.equal(new URL(url).searchParams.get('phaseId'),phaseId);assert.equal(init.headers.authorization,undefined);
  return {ok:true,json:async()=>[{TeamId:id(3),'Team Name':'Registered team','Total Games':null,'Total Points':null,private:'never project'}]};
 }});
 assert.deepEqual(rows,[{id:id(3),name:'Registered team',logoUrl:null}]);
 await assert.rejects(readDirectoryTeams({seasonId,phaseId}),TypeError);
 await assert.rejects(readDirectoryTeams({phaseId},{fetchImpl:async()=>({ok:true,json:async()=>[{TeamId:id(3),'Team Name':'A'},{TeamId:id(3),'Team Name':'A'}]})}),/identity/);
});

test('catalog outage retains scoped imported directory for older tournaments',async()=>{
 const d=await portalDirectory('YHG',seasonId,{...options(),fetchCompetitions:async()=>{throw Error('offline');},loadPortalDirectory:async()=>[{organization_id:id(1),season_id:seasonId,group_id:groupId,group_name:'Imported group',phase_id:phaseId,phase_name:'Imported phase',home_team_id:id(8),home_team_name:'Imported team'}]});
 assert.equal(d.source,'imported-hms-games');assert.equal(d.teams[0].id,id(8));
});

test('large hierarchies cap cold membership requests and mark remaining scopes unknown',async()=>{
 const competition=structuredClone(fixture.competition),g=competition.Seasons[0].Groups[0];
 g.Phases=Array.from({length:40},(_,i)=>({phaseId:id(200+i),groupId:g.groupId,name:'Phase '+i}));
 let calls=0;
 const d=await portalDirectory('YHG',seasonId,{...options(),fetchCompetitions:async()=>[competition],readDirectoryTeams:async()=>{calls++;return [];}});
 assert.equal(calls,32);assert.equal(d.membershipComplete,false);assert.equal(d.groups[0].phases.length,40);
 assert.equal(d.groups[0].phases.at(-1).teamsAvailable,false);assert.equal(d.teamCount,null);
});

test('concurrent directory consumers share bounded live reads and cached hierarchy',async()=>{
 const original=globalThis.fetch,org={code:'CACHE_TEST',id:id(101),token:'test-cache-token'};
 let calls=0,active=0,maximum=0;
 globalThis.fetch=async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/organization'))return {ok:true,json:async()=>({organizationId:org.id})};
  if(u.pathname.endsWith('/competitions'))return {ok:true,json:async()=>[fixture.competition]};
  calls++;active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,5));active--;
  const rows=fixture.tables.find(t=>Object.entries(t.scope).every(([k,v])=>u.searchParams.get(k)===v)).rows;
  return {ok:true,json:async()=>official(rows)};
 };
 try{
  const values=await Promise.all(Array.from({length:8},()=>loadPortalHmsDirectory(org,seasonId)));
  assert.ok(values.every(v=>v.teamCount===10));assert.equal(calls,5);assert.ok(maximum<=4);
  await loadPortalHmsDirectory(org,seasonId);assert.equal(calls,5);
 }finally{globalThis.fetch=original;}
});
