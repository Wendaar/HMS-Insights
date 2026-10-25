import test from 'node:test';
import assert from 'node:assert/strict';
import {people,periods,normalizeGame,warnings,aggregate,csv} from '../public/operations/model.js';
import {readOperations} from '../src/app/operations.js';
import {createOperationsHandler} from '../src/web/operations-handler.js';
import {appsForOrganization} from '../public/control/registry.js';
import {server} from '../src/server.js';
const org='bb669217-41eb-4162-8040-a73f49a43570',id='11111111-1111-4111-8111-111111111111';
const fixture=(patch={})=>({gameId:id,organizationId:org,startDate:'2026-10-01',startTime:'19:00',status:'FINISHED',HomeTeam:{teamId:'home',name:'Home',foreignId:'CASH'},AwayTeam:{teamId:'away',name:'Away',foreignId:'INVOICE'},referee:'Jan; Petr; Jan',timekeeper:[{firstName:'Anna',lastName:'Malá',email:'PRIVATE'}],Phase:{Group:{Season:{Competition:{competitionId:'league',name:'Liga'}}}},payment:'UNPAID',...patch});
const rules={cashPath:'foreignId',paidPath:'payment',paidValue:'PAID',unpaidValues:['UNPAID']};
const env={HMS_API_TOKEN:'api-secret',HMS_PHM_OPERATIONS_SECRET:'viewer-secret'};
const query={org:'phm',from:'2026-10-01',to:'2026-10-31'};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;}};}
test('periods respect calendar dates, leap days, range bounds and inclusive equal-length comparisons',()=>{
 assert.deepEqual(periods('2026-10-01','2026-10-31'),{previous:{from:'2026-08-31',to:'2026-09-30'},selected:{from:'2026-10-01',to:'2026-10-31'},next:{from:'2026-11-01',to:'2026-12-01'}});
 assert.doesNotThrow(()=>periods('2024-02-29','2024-02-29'));for(const range of [['2026-02-30','2026-03-01'],['2026-10-31','2026-10-01'],['2026-01-01','2026-12-31']])assert.throws(()=>periods(...range));
});
test('multi-value officials split and deduplicate without returning private person fields',()=>{
 assert.deepEqual(people(['Jan; Petr','Jan',{firstName:'Anna',lastName:'Malá',email:'PRIVATE'}]),['Jan','Petr','Anna Malá']);assert.equal(people(undefined),null);assert.deepEqual(people(null),[]);
 assert.doesNotMatch(JSON.stringify(normalizeGame(fixture(),rules)),/PRIVATE|foreignId|organizationId/);
});
test('staff missing, source unknown, unfilled future ice and past opponents stay distinct',()=>{
 const g=normalizeGame(fixture({referee:null,timekeeper:undefined,AwayTeam:null}),rules);
 assert.deepEqual(warnings(g,'2026-10-01'),['staff_unknown','referee','ice']);
 assert.ok(warnings(g,'2026-10-02').includes('past_teams'));assert.ok(!warnings(g,'2026-10-02').includes('ice'));
 assert.deepEqual(warnings({...g,status:'CANCELLED'},'2026-10-02'),[]);
});
test('CASH and PAID require explicit mapping and exact typed values; unknown is never a proven debt',()=>{
 assert.ok(warnings(normalizeGame(fixture()),'2026-10-25').includes('cash_unknown'));
 assert.ok(warnings(normalizeGame(fixture(),rules),'2026-10-25').includes('cash'));
 assert.ok(warnings(normalizeGame(fixture({payment:'OTHER'}),rules),'2026-10-25').includes('payment_unknown'));
 assert.ok(!warnings(normalizeGame(fixture({payment:'PAID'}),rules),'2026-10-25').includes('cash'));
 assert.equal(normalizeGame(fixture({HomeTeam:{foreignId:'CASHLESS'}}),rules).home.cash,false);
 assert.equal(normalizeGame(fixture({payment:true}),rules).paid,null);
});
test('attendance aggregates person × role × competition once per game, filters all comparable periods',()=>{
 const games=[normalizeGame(fixture(),rules),normalizeGame(fixture({gameId:'prev',startDate:'2026-09-02'}),rules),normalizeGame(fixture({gameId:'next',startDate:'2026-11-02'}),rules),normalizeGame(fixture({gameId:'cancel',status:'CANCELLED'}),rules)];
 const model=aggregate(games,query,{today:'2026-10-25'});assert.equal(model.staff.length,3);assert.equal(model.staff.find(p=>p.name==='Jan').selected,1);assert.equal(model.staff.find(p=>p.name==='Jan').previous,1);assert.equal(model.staff.find(p=>p.name==='Jan').next,1);assert.equal(model.teams[0].games,1);assert.equal(model.teams[1].games,1);
 assert.equal(aggregate(games,query,{competition:'missing',today:'2026-10-25'}).staff.length,0);
});
test('CSV preserves Unicode, quotes and neutralizes spreadsheet formulas',()=>{
 const result=csv([{name:'=HYPERLINK("x")',n:'Čas; led'}],[['name','Jméno'],['n','Poznámka']]);assert.match(result,/^\ufeff/);assert.ok(result.includes('"\'=HYPERLINK(""x"")"'));assert.ok(result.includes('"Čas; led"'));
});
test('operations endpoint denies access before reading, has no webhook fallback and isolates organizations',async()=>{
 let reads=0;const handler=createOperationsHandler({env,read:async()=>{reads++;return {org:'PHM'};}});
 for(const headers of [{},{authorization:'Bearer wrong'},{'x-hms-webhook-secret':'viewer-secret'}]){const res=response();await handler({method:'GET',headers,query},res);assert.equal(res.code,401);assert.equal(res.headers['cache-control'],'private, no-store');}assert.equal(reads,0);
 const allowed=response();await handler({method:'GET',headers:{authorization:'Bearer viewer-secret'},query},allowed);assert.equal(allowed.code,200);assert.equal(reads,1);
 const other=response();await handler({method:'GET',headers:{authorization:'Bearer viewer-secret'},query:{...query,org:'euchl'}},other);assert.equal(other.code,503);assert.equal(reads,1);
 const access=response();await handler({method:'GET',headers:{},query:{org:'phm',action:'access'}},access);assert.equal(access.code,200);assert.doesNotMatch(JSON.stringify(access.body),/viewer-secret|api-secret|bb669/);
 const noFallback=response();await createOperationsHandler({env:{HMS_WEBHOOK_SECRET:'webhook'}})({method:'GET',headers:{authorization:'Bearer webhook'},query},noFallback);assert.equal(noFallback.code,503);
});
test('full read scopes token and range, follows pages, sanitizes payload and confirms completeness',async()=>{
 let calls=0;const result=await readOperations(query,{env,fetchGames:async(params,options)=>{assert.equal(options.config.token,'api-secret');assert.equal(params.from,'2026-08-31');assert.equal(params.to,'2026-12-01');calls++;return [fixture()];}});assert.equal(calls,1);assert.equal(result.complete,true);assert.equal(result.org,'PHM');assert.equal(result.games.length,1);assert.doesNotMatch(JSON.stringify(result),/api-secret|PRIVATE/);
});
test('foreign, out-of-range, invalid and duplicate source games abort the entire read',async()=>{
 for(const rows of [[fixture({organizationId:'other'})],[fixture({startDate:'2027-01-01'})],[fixture({gameId:'bad'})],[fixture(),fixture()]])await assert.rejects(readOperations(query,{env,fetchGames:async()=>rows}));
});
test('live source limit is never silently accepted as a complete closing dataset',async()=>{
 let calls=0;await assert.rejects(readOperations(query,{env,fetchGames:async()=>Array.from({length:100},()=>fixture({gameId:`${String(++calls).padStart(8,'0')}-1111-4111-8111-111111111111`}))}));assert.equal(calls,1100);
});
test('Operations is a scoped Beta app in PHM/EUCHL map, without fallback for planned organizations',()=>{
 for(const o of ['phm','euchl']){const app=appsForOrganization(o).find(a=>a.id==='operations');assert.equal(app.status,'partial');assert.equal(app.links.open,'/operations?org='+o);}assert.deepEqual(appsForOrganization('yhg').find(a=>a.id==='operations').links,{});
});
test('public shell and demo serve without exposing live data; protected API remains closed',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base=`http://127.0.0.1:${server.address().port}`;for(const path of ['/operations?org=phm','/operations/model.js','/operations/demo.js']){const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');}const r=await fetch(base+'/api/operations?org=phm');assert.ok([401,503].includes(r.status));}finally{await new Promise(resolve=>server.close(resolve));}
});
