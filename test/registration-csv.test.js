import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRegistrationImport,parseRegistrationCsv} from '../src/app/registration-csv.js';
import {registrationSnapshotStore,registrationPortraits} from '../src/infrastructure/registration-snapshots.js';
import {createRegistrationControlHandler} from '../src/web/registration-control-handler.js';
import {REGISTRATION_SCOPE as scope} from '../src/app/registration-control.js';
const a='11111111-1111-4111-8111-111111111111',b='22222222-1111-4111-8111-111111111111',player='33333333-1111-4111-8111-111111111111',reg='44444444-1111-4111-8111-111111111111';
const catalog=[{id:a,name:'Tým A'},{id:b,name:'Tým B'}];
const headers=['Created At','Player','Teams','Competition','Season','Participation Fee','Accepted by Player','Payment Status','Payment Method','Registration Status','Updated At','Created At','Action','Player Link','ID','Email'];
const fixture=(patch={})=>({'Created At':'29.10.2026 16:10:12',Player:'Testovací hráč',Teams:'Tým A',Competition:'PHM Cup',Season:'2026-2027','Accepted by Player':'YES','Player Link':'https://prod.hms.wootera.net/org/phm/players/'+player,ID:reg,Email:'PRIVATE-EMAIL',...patch});
const csv=(rows=[fixture()],delimiter=';')=>[headers,...rows.map(row=>headers.map(h=>row[h]??''))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(delimiter)).join('\r\n');
test('real HMS header shape allows duplicated Created At, BOM, CRLF, semicolons/commas and escaped multiline values',()=>{
 for(const delimiter of [';',',']){const parsed=parseRegistrationCsv('\uFEFF'+csv([fixture({Player:'Jan "Test"\nNový'})],delimiter));assert.equal(parsed.rows[0].get('Player'),'Jan "Test"\nNový');}
 assert.throws(()=>parseRegistrationCsv(csv().replace('"Player"','"Teams"')),/duplicitní/);
 assert.throws(()=>parseRegistrationCsv(csv()+'"'),/uvozov/);
 assert.throws(()=>parseRegistrationCsv('x'.repeat(2000001)),/2 MB/);
});
test('only exact PHM Cup 2026-2027 rows; no email storage or inferred invite, membership, payment and confirmation',()=>{
 const data=buildRegistrationImport(csv([fixture(),fixture({ID:b,Season:'2025-2026'}),fixture({ID:a,Competition:'Other'})]),catalog);
 assert.equal(data.summary.seasonRows,1);assert.equal(data.summary.excludedScope,2);assert.equal(data.summary.unknownPaid,1);
 const p=data.teams[0].players[0];assert.equal(p.paid,null);assert.equal(p.confirmed,null);assert.equal(p.invited,null);assert.equal(p.memberStatus,null);assert.equal(p.ok,false);
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE-EMAIL|email/);
 assert.throws(()=>buildRegistrationImport(csv([fixture({Season:'2025-2026'})]),catalog),/neobsahuje registrace/);
});
test('team matching never splits concatenated names or assigns by substring; explicit scoped mapping is retained only for the same identity and team text',()=>{
 const source=csv([fixture({Teams:'Tým ATým B'})]);
 const pending=buildRegistrationImport(source,catalog);assert.equal(pending.summary.assigned,0);assert.equal(pending.pending.length,1);
 const mapped=buildRegistrationImport(source,catalog,{mappings:{[reg]:b}});assert.equal(mapped.teams[1].players[0].playerId,player);
 const repeated=buildRegistrationImport(source,catalog,{previous:mapped});assert.equal(repeated.summary.assigned,1);
 const changed=buildRegistrationImport(csv([fixture({Teams:'Tým BTým A'})]),catalog,{previous:mapped});assert.equal(changed.summary.unassigned,1);
 assert.throws(()=>buildRegistrationImport(source,catalog,{mappings:{[reg]:reg}}),/mimo tuto sezonu/);
 assert.throws(()=>buildRegistrationImport(source,catalog,{mappings:{[a]:b}}),/nepatří/);
});
test('registration and player identities are mandatory, duplicate players per team rejected, malformed CSV never partially imports',()=>{
 assert.throws(()=>buildRegistrationImport(csv([fixture(),fixture()]),catalog),/duplicitní/);
 assert.throws(()=>buildRegistrationImport(csv([fixture(),fixture({ID:b})]),catalog),/více registrací/);
 assert.throws(()=>buildRegistrationImport(csv([fixture({'Player Link':'https://attacker.invalid/'+player})]),catalog),/odkaz hráče/);
 assert.throws(()=>buildRegistrationImport(csv([fixture({'Player Link':'https://prod.hms.wootera.net/org/euchl/players/'+player})]),catalog),/odkaz hráče/);
 assert.throws(()=>buildRegistrationImport(csv([fixture({'Payment Status':'maybe'})]),catalog),/úhrady/);
});
test('explicit CASH unpaid, confirmed and unknown values remain independent',()=>{
 const data=buildRegistrationImport(csv([fixture({'Payment Status':'UNPAID','Payment Method':'CASH','Registration Status':'Waiting','Accepted by Player':'NO'})]),catalog);
 const p=data.teams[0].players[0];assert.equal(p.accepted,false);assert.equal(p.paid,false);assert.equal(p.confirmed,false);assert.match(p.actions.join(' '),/Platí manažer/);
 const paid=buildRegistrationImport(csv([fixture({'Payment Status':'PAID','Payment Method':'COMGATE','Registration Status':'Confirmed'})]),catalog);assert.equal(paid.teams[0].players[0].ok,true);
});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const env={HMS_PHM_OPERATIONS_SECRET:'test-only',DATABASE_URL:'fake'};
const headersAuth={host:'example.invalid',origin:'https://example.invalid',authorization:'Bearer test-only'};
function harness(){let snapshot=null,reads=0;
 const snapshots={async get(){return snapshot;},async save(_scope,payload,revision){if((snapshot?.revision??0)!==revision)return null;snapshot={payload,revision:revision+1,uploadedAt:'2026-10-29T15:10:00Z'};return {revision:snapshot.revision,uploaded_at:snapshot.uploadedAt};}};
 const handler=createRegistrationControlHandler({env,snapshots,teamCatalog:async()=>{reads++;return catalog;},portraits:async t=>t,
  store:{list:async()=>[],rate:async()=>true,resolve:async token=>token==='a'.repeat(43)?{team_id:a}:null}});
 const call=async(action,body,patch={})=>{const r=response();await handler({method:['preview-import','import'].includes(action)?'POST':'GET',query:{action},headers:headersAuth,body,...patch},r);return r;};
 return {call,get snapshot(){return snapshot;},get reads(){return reads;}};
}
test('preview is read-only, upload is authorized, same-origin, validates full export and atomically replaces an expected revision',async()=>{
 const h=harness(),body={csv:csv(),filename:'Season_Player_Registrations-All-20261029-161012.csv'};
 const anonymous=await h.call('preview-import',body,{headers:{host:'example.invalid',origin:'https://example.invalid'}});assert.equal(anonymous.code,401);assert.equal(h.reads,0);
 const cross=await h.call('import',body,{headers:{...headersAuth,origin:'https://attacker.invalid'}});assert.equal(cross.code,403);
 const preview=await h.call('preview-import',body);assert.equal(preview.code,200);assert.equal(h.snapshot,null);
 const noAck=await h.call('import',{...body,...preview.body});assert.equal(noAck.code,400);
 const request={...body,sourceHash:preview.body.sourceHash,revision:0,completeExport:true};
 const uploaded=await h.call('import',request);assert.equal(uploaded.code,200);assert.equal(h.snapshot.revision,1);
 const stale=await h.call('import',request);assert.equal(stale.code,409);assert.equal(h.snapshot.revision,1);
 const corrupt=await h.call('import',{...request,csv:'bad'});assert.equal(corrupt.code,400);assert.equal(h.snapshot.revision,1);
 const newPreview=await h.call('preview-import',body);const next=await h.call('import',{...request,revision:1,sourceHash:newPreview.body.sourceHash});assert.equal(next.code,200);assert.equal(h.snapshot.revision,2);
});
test('pending players require explicit exclusion, never leak to manager route, and fully unassigned data cannot replace good data',async()=>{
 const h=harness(),body={csv:csv([fixture(),fixture({ID:b,Player:'UNASSIGNED-PRIVATE',Teams:'Tým ATým B','Player Link':'https://prod.hms.wootera.net/org/phm/players/'+a})]),filename:'All.csv'};
 const preview=await h.call('preview-import',body);assert.equal(preview.body.pending.length,1);
 const request={...body,sourceHash:preview.body.sourceHash,revision:0,completeExport:true};
 assert.equal((await h.call('import',request)).code,400);
 assert.equal((await h.call('import',{...request,acceptExcluded:true})).code,200);
 const team=await h.call('team',undefined,{headers:{authorization:'Bearer '+'a'.repeat(43)}});assert.equal(team.code,200);
 assert.equal(team.body.source.type,'csv');assert.doesNotMatch(JSON.stringify(team.body),/UNASSIGNED-PRIVATE|PRIVATE-EMAIL|sourceHash|assignments/);
});
test('snapshot SQL uses scoped CAS, stores no pending rows, and separates previews from production',async()=>{
 const calls=[],sql={async query(text,values=[]){calls.push({text,values});return [];}};
 const payload=buildRegistrationImport(csv(),catalog);
 await registrationSnapshotStore({sql}).save(scope,payload,2);
 assert.match(calls.at(-1).text,/hms_registration_snapshots_preview/);assert.match(calls.at(-1).text,/and revision=\$5/);
 assert.equal(calls.at(-1).values[4],2);assert.ok(!Object.hasOwn(JSON.parse(calls.at(-1).values[3]),'pending'));
 await registrationSnapshotStore({sql,env:{VERCEL_ENV:'production'}}).save(scope,payload,0);assert.doesNotMatch(calls.at(-1).text,/_preview/);assert.match(calls.at(-1).text,/on conflict do nothing/);
});
test('portrait enrichment uses exact player IDs, organization, season and team; image hosts are allowlisted',async()=>{
 let query;
 const team=buildRegistrationImport(csv(),catalog).teams[0];
 const sql={async query(text,values){query={text,values};return [{player_id:player,image_url:'https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/player_[size].png'}];}};
 const data=await registrationPortraits(team,{sql,env:{}});assert.ok(data.players[0].photoUrl);assert.deepEqual(query.values,[scope.organizationId,scope.seasonId,a,[player]]);
 const foreign=await registrationPortraits(team,{env:{},sql:{async query(){return [{player_id:player,image_url:'https://attacker.invalid/photo'}];}}});assert.equal(foreign.players[0].photoUrl,null);
});
