import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapInstance,validateSettings,parseCsv,normalizePlayers,publicSettings} from '../src/app/playoff-players.js';
import {createToolsHandler} from '../src/web/tools-handler.js';
import {toolStore} from '../src/infrastructure/tool-instances.js';
import {readPlayoffSource} from '../src/infrastructure/tool-sources.js';
const config=()=>structuredClone(bootstrapInstance('PHM','phm-cup-2026').draft);
const csv='Competition,Season,Phase,FirstName,LastName,Team,Team Id,Player Id,GP,G,A,Email\nPHM Cup,2025-2026,Základní část,Adam,Novák,Tým A,a,adam,9,2,3,private@example.com\nPHM Cup,2025-2026,Základní část,Petr,Malý,Tým A,a,petr,8,1,0,private@example.com\nPHM Cup,2025-2026,Základní část,Jan,Neznámý,Tým B,b,jan,,0,0,private@example.com\nPHM Cup,2026-2027,Základní část,Jiná,Sezona,Tým B,b,other,20,0,0,private@example.com';
const source=async c=>({...normalizePlayers(parseCsv(csv),c),sourceLabel:'Testovací Google Sheet',readAt:'2026-10-23T10:00:00Z'});
export function memoryToolStore(){
  const entries=new Map();const key=(org,slug)=>org+':'+slug;
  return {entries,async get(o,s){return structuredClone(entries.get(key(o,s))??null);},async list(o){return [...entries].filter(([k])=>k.startsWith(o+':')).map(([k,v])=>({slug:k.split(':')[1],title:v.draft.title,revision:v.revision,published:!!v.published}));},
    async save(o,s,d,r,b){const k=key(o,s),old=entries.get(k);if((old?.revision??0)!==r)return null;const item={draft:structuredClone(d),published:structuredClone(old?.published??b?.published??null),revision:r+1,updatedAt:'2026-10-23',publishedAt:old?.publishedAt??null};entries.set(k,item);return structuredClone(item);},
    async publish(o,s,r){const item=entries.get(key(o,s));if(!item||item.revision!==r)return null;item.published=structuredClone(item.draft);item.revision++;item.publishedAt='2026-10-23';return structuredClone(item);}};
}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(value){this.body=value;return this;}};}
async function call(handler,action='public',body,extra={}){const res=response();await handler({method:body?'POST':'GET',query:{org:'phm',instance:'phm-cup-2026',action,...extra.query},headers:{authorization:'Bearer test-secret',host:'localhost',...extra.headers},body,...extra,...(extra.query?{query:{org:'phm',instance:'phm-cup-2026',action,...extra.query}}:{})},res);return res;}
test('playoff rules scope season/phase, keep unknown starts and allowlist sporting data',async()=>{
  const data=await source(config());assert.equal(data.players.length,3);
  assert.equal(data.players.find(p=>p.id==='adam').eligibility,'eligible');assert.equal(data.players.find(p=>p.id==='petr').eligibility,'below');
  assert.equal(data.players.find(p=>p.id==='jan').eligibility,'unknown');assert.equal(data.players.find(p=>p.id==='adam').points,5);
  assert.equal(JSON.stringify(data).includes('private@'),false);assert.equal(JSON.stringify(publicSettings(config())).includes('spreadsheetId'),false);
  const next=config();next.minStarts=10;assert.equal((await source(next)).players.find(p=>p.id==='adam').eligibility,'below');
});
test('CSV handles BOM, quotes/newlines, rejects malformed data and conflicting duplicates',()=>{
  assert.equal(parseCsv('\uFEFFName,GP\r\n"A, B\nC",9\r\n').rows[0].Name,'A, B\nC');
  for(const input of ['Name,Name\nA,B','Name,GP\n"unterminated,9','Name,GP\nA,1,2'])assert.throws(()=>parseCsv(input));
  const table=parseCsv(csv);table.rows.push({...table.rows[0],GP:'19'});assert.throws(()=>normalizePlayers(table,config()),/rozdílné řádky/);
  const c=config();c.source.mapping.starts='Wrong';assert.throws(()=>normalizePlayers(parseCsv(csv),c),/Chybí sloupec/);
  c.source.mapping.starts='GP';assert.equal(normalizePlayers(parseCsv(csv),c).players.length,3);
  assert.throws(()=>normalizePlayers(parseCsv('Name,Team\nA,B'),config()),/počet startů/);
});
test('settings drop arbitrary fields and reject unsafe URLs, invalid limits and providers',()=>{
  for(const minStarts of [-1,0,201,NaN,'9'])assert.throws(()=>validateSettings({...config(),minStarts}));
  assert.throws(()=>validateSettings({...config(),accent:'red; display:none'}));
  assert.throws(()=>validateSettings({...config(),source:{type:'url',spreadsheetId:'http://127.0.0.1'}}));
  assert.equal(validateSettings({...config(),secret:'drop'}).secret,undefined);
  assert.equal(bootstrapInstance('YHG','phm-cup-2026'),null);
});
test('Sheets adapter follows only Google data redirects, bounds responses and rejects login HTML',async()=>{
  const result=await readPlayoffSource(config(),{fetchImpl:async(url,options)=>{assert.equal(new URL(url).hostname,'docs.google.com');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(options.headers.authorization,undefined);return new Response(csv);}});
  assert.equal(result.players.length,3);
  await assert.rejects(readPlayoffSource(config(),{fetchImpl:async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}})}),/Nepovolené/);
  await assert.rejects(readPlayoffSource(config(),{fetchImpl:async()=>new Response('<html>login</html>')}),/přihlášení/);
  await assert.rejects(readPlayoffSource(config(),{fetchImpl:async()=>new Response('x',{headers:{'content-length':String(5*1024*1024)}})}));
});
test('shared instances preserve publication, reject stale revisions and duplicate into unpublished drafts',async()=>{
  const store=memoryToolStore(),handler=createToolsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'test-secret',DATABASE_URL:'test'},store,readSource:source});
  assert.equal((await call(handler)).body.config.minStarts,9);
  const draft=config();draft.minStarts=12;
  let r=await call(handler,'save',{revision:0,config:draft});assert.equal(r.code,200);assert.equal(r.body.instance.revision,1);
  assert.equal((await call(handler)).body.config.minStarts,9);
  assert.equal((await call(handler,'save',{revision:0,config:config()})).code,409);
  r=await call(handler,'publish',{revision:1});assert.equal(r.code,200);assert.equal(r.body.instance.revision,2);
  // A fresh handler/context reads the same central state.
  const other=createToolsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'test-secret'},store,readSource:source});
  assert.equal((await call(other)).body.config.minStarts,12);
  r=await call(handler,'duplicate',{slug:'phm-cup-2027',title:'Playoff 2027'});assert.equal(r.code,201);assert.equal(r.body.instance.published,null);
  assert.equal((await call(handler,'duplicate',{slug:'phm-cup-2027',title:'Another'})).code,409);
  assert.equal((await call(handler,'public',undefined,{query:{instance:'phm-cup-2027'}})).code,404);
  assert.equal((await call(handler,'public',undefined,{query:{org:'yhg'}})).code,404);
  const broken=structuredClone(draft);broken.source.filters.season='2099';
  await call(handler,'save',{revision:2,config:broken});assert.equal((await call(handler,'publish',{revision:3})).code,422);
  assert.equal((await call(other)).body.config.minStarts,12);
});
test('authorization and validation precede data reads or writes; errors never expose infrastructure secrets',async()=>{
  let reads=0;const store={get:async()=>{reads++;throw new Error('postgres://private-secret');}},handler=createToolsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'test-secret'},store});
  assert.equal((await call(handler,'manage',undefined,{headers:{}})).code,401);assert.equal(reads,0);
  assert.equal((await call(handler,'manage',undefined,{headers:{authorization:'Bearer wrong'}})).code,401);assert.equal(reads,0);
  assert.equal((await call(handler,'save',{}, {headers:{authorization:'Bearer test-secret',origin:'https://evil.test',host:'localhost'}})).code,403);assert.equal(reads,0);
  assert.equal((await call(handler,'public',undefined,{query:{org:'unknown'}})).code,404);assert.equal(reads,0);
  assert.equal((await call(handler,'public',undefined,{query:{instance:'../bad'}})).code,400);assert.equal(reads,0);
  const r=await call(handler);assert.equal(r.code,503);assert.equal(JSON.stringify(r.body).includes('private-secret'),false);
});
test('Postgres store scopes all instances, compares revisions and separates draft from publication',async()=>{
  const calls=[],store=toolStore({sql:{query:async(text,values)=>{calls.push({text,values});return [];}}});
  await store.get('YHG','season');await store.list('YHG');await store.save('YHG','season',config(),0,null);await store.save('YHG','season',config(),4,null);await store.publish('YHG','season',5);
  for(const call of calls.filter(c=>!c.text.startsWith('create table'))){assert.ok(call.values.includes('YHG'));assert.match(call.text,/organization/);}
  assert.match(calls.find(c=>c.text.startsWith('insert')).text,/on conflict do nothing/);
  const update=calls.find(c=>c.text.startsWith('update')&&c.text.includes('draft=$4'));assert.match(update.text,/revision=\$5/);assert.equal(update.values[4],4);assert.doesNotMatch(update.text,/set published/);
  assert.match(calls.at(-1).text,/published=draft/);assert.equal(calls.at(-1).values[3],5);
});
