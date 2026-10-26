import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionCookie, clearSessionCookie, hasOperationsSession, SESSION_SECONDS} from '../src/security/operations-session.js';
import {createOperationsHandler} from '../src/web/operations-handler.js';
import {saveSnapshot, readSnapshot, clearSnapshot, SNAPSHOT_TTL} from '../public/operations/snapshot.js';
import {normalizeGame, aggregate, people, warnings, staffRanking, personAssignments} from '../public/operations/model.js';
const org={code:'PHM'},secret='test-viewer',now=Date.parse('2026-10-26T00:00:00Z');
const cookie=()=>sessionCookie(org,secret,now).split(';')[0];
const req=(patch={})=>({method:'GET',query:{org:'phm'},headers:{},...patch});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;}});
test('signed session is HttpOnly, Secure, same-site, organization scoped and expires',()=>{
 const value=sessionCookie(org,secret,now);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/api'])assert.ok(value.includes(flag));assert.doesNotMatch(value,/test-viewer/);
 assert.equal(hasOperationsSession(req({headers:{cookie:cookie()}}),org,secret,now),true);
 assert.equal(hasOperationsSession(req({headers:{cookie:cookie()}}),{code:'EUCHL'},secret,now),false);
 assert.equal(hasOperationsSession(req({headers:{cookie:cookie()}}),org,'changed-key',now),false);
 assert.equal(hasOperationsSession(req({headers:{cookie:cookie()}}),org,secret,now+SESSION_SECONDS*1000),false);
 const tampered=cookie().replace(/.$/,'!');assert.equal(hasOperationsSession(req({headers:{cookie:tampered}}),org,secret,now),false);
 assert.match(clearSessionCookie(org),/Max-Age=0/);
});
test('a viewer unlock creates a session, refresh checks it without source reads, logout clears it',async()=>{
 let reads=0;const handler=createOperationsHandler({env:{HMS_PHM_OPERATIONS_SECRET:secret},now:new Date(now),read:async()=>{reads++;return {org:'PHM'};}});
 const unlock=res();await handler(req({method:'POST',query:{org:'phm',action:'session'},headers:{authorization:'Bearer '+secret}}),unlock);
 assert.equal(unlock.code,200);assert.equal(unlock.body.authorized,true);const jar=unlock.headers['set-cookie'].split(';')[0];assert.doesNotMatch(JSON.stringify(unlock.body),/test-viewer/);
 const access=res();await handler(req({query:{org:'phm',action:'access'},headers:{cookie:jar}}),access);assert.equal(access.body.authorized,true);assert.equal(reads,0);
 const data=res();await handler(req({headers:{cookie:jar}}),data);assert.equal(data.code,200);assert.equal(reads,1);assert.equal(data.headers.vary,'Authorization, Cookie');
 const logout=res();await handler(req({method:'POST',query:{org:'phm',action:'logout'},headers:{cookie:jar}}),logout);assert.equal(logout.code,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
});
test('wrong codes, cross-origin requests, forged or cross-org sessions remain blocked',async()=>{
 const handler=createOperationsHandler({env:{HMS_PHM_OPERATIONS_SECRET:secret,HMS_EUCHL_OPERATIONS_SECRET:secret},now:new Date(now),read:async()=>{throw Error('must not read');}});
 const wrong=res();await handler(req({method:'POST',query:{org:'phm',action:'session'},headers:{authorization:'Bearer nope'}}),wrong);assert.equal(wrong.code,401);assert.equal(wrong.headers['set-cookie'],undefined);
 const origin=res();await handler(req({method:'POST',query:{org:'phm',action:'session'},headers:{authorization:'Bearer '+secret,origin:'https://other.test',host:'app.phmcup.cz'}}),origin);assert.equal(origin.code,403);
 const cross=res();await handler(req({query:{org:'euchl'},headers:{cookie:cookie()}}),cross);assert.equal(cross.code,401);
 const forged=res();await handler(req({headers:{cookie:'hms_ops_phm=fake.fake'}}),forged);assert.equal(forged.code,401);
});
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
const game=(patch={})=>normalizeGame({gameId:'g1',startDate:'2026-10-10',startTime:'18:00',status:'FINISHED',HomeTeam:{teamId:'a',name:'Home'},AwayTeam:{teamId:'b',name:'Away'},Venue:{name:'Ice'},Competition:{competitionId:'c1',name:'Cup'},referee:'Jan; Petr',timekeeper:'Anna',...patch});
const range={from:'2026-10-01',to:'2026-10-31'};
const snapshot=()=>({loadedAt:now,range,view:'games',filters:{competition:'c1',payment:'',q:'Jan'},data:{org:'PHM',organizationSlug:'phm',complete:true,readAt:new Date(now).toISOString(),games:[game()]}});
test('a completed tab snapshot restores data and context on refresh, without a code or source read',()=>{
 const storage=store(),value=snapshot();assert.equal(saveSnapshot(storage,'phm',value,now),true);assert.deepEqual(readSnapshot(storage,'phm',now+1000),{v:1,...value});assert.equal(readSnapshot(storage,'euchl',now+1000),null);
 assert.equal(readSnapshot(storage,'phm',now+SNAPSHOT_TTL+1),null);clearSnapshot(storage,'phm');assert.equal(readSnapshot(storage,'phm',now),null);
});
test('incomplete, malformed, wrongly-scoped snapshots and unavailable browser storage are rejected',()=>{
 const storage=store();assert.equal(saveSnapshot(storage,'phm',{...snapshot(),data:{...snapshot().data,complete:false}},now),false);
 assert.equal(saveSnapshot(storage,'euchl',snapshot(),now),false);
 const broken={...snapshot(),data:{...snapshot().data,games:[{...game(),referees:{name:'bad'}}]}};saveSnapshot(storage,'phm',broken,now);assert.equal(readSnapshot(storage,'phm',now),null);
 const denied={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};assert.equal(saveSnapshot(denied,'phm',snapshot(),now),false);assert.equal(readSnapshot(denied,'phm',now),null);assert.doesNotThrow(()=>clearSnapshot(denied,'phm'));
});
test('NENI POTREBA is not a person, shift or missing-staff warning',()=>{
 const row=game({referee:'NENÍ POTŘEBA',timekeeper:'neni potreba'});assert.deepEqual(people('NENÍ POTŘEBA; Jan'),['Jan']);assert.equal(row.refereeNotRequired,true);assert.equal(row.timekeeperNotRequired,true);
 const model=aggregate([row],range,{today:'2026-10-26'});assert.equal(model.staff.length,0);assert.ok(!warnings(row,'2026-10-26').includes('referee'));assert.ok(!warnings(row,'2026-10-26').includes('timekeeper'));
 assert.deepEqual(staffRanking([{name:'NENÍ POTŘEBA',competition:'Cup',selected:23}]),[]);
});
test('bar detail lists the exact games, venues and roles represented by its period/competition count',()=>{
 const rows=[game(),game({gameId:'g2',startDate:'2026-09-10'}),game({gameId:'g3',referee:'Jan',timekeeper:'Jan',Competition:{competitionId:'c2',name:'Liga'}}),game({gameId:'g4',status:'CANCELLED'})];
 const model=aggregate(rows,range,{today:'2026-10-26'}),rank=staffRanking(model.staff).find(person=>person.name==='Jan');
 const assignments=personAssignments(rows,range,{name:'Jan',today:'2026-10-26'});assert.equal(assignments.length,rank.total);assert.equal(assignments.length,3);assert.ok(assignments.every(row=>row.venue==='Ice'&&row.match==='Home — Away'));
 assert.equal(personAssignments(rows,range,{name:'Jan',role:'Časoměřič',today:'2026-10-26'}).length,1);
 assert.equal(personAssignments(rows,range,{name:'Jan',competition:'c1',today:'2026-10-26'}).length,1);
 const prev=personAssignments(rows,{from:'2026-09-01',to:'2026-09-30'},{name:'Jan',today:'2026-10-26'});assert.equal(prev.length,1);assert.equal(prev[0].id,'g2');
});
test('a globally missing billing field is not repeated as an accusation against every team/game',()=>{
 const rows=[game(),game({gameId:'g2'})];const model=aggregate(rows,range,{today:'2026-10-26'});assert.ok(model.games.every(row=>!row.warnings.includes('cash_unknown')));assert.ok(model.teams.every(row=>row.payment==='API neposkytuje'));
});
