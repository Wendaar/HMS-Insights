import test from 'node:test';
import assert from 'node:assert/strict';
import {createVirtualCameraHandler,cameraTable} from '../src/web/virtual-camera-handler.js';
import {crop,sourceURL} from '../public/virtual-camera/core.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
function memoryStore(){const rows=new Map();return {rows,async create(id,edit_hash,read_hash,state){const row={id,edit_hash,read_hash,state,revision:1,operator_at:0,output_at:0,output_status:'Neznámý'};rows.set(id,row);return row;},async get(id){return rows.get(id);},async update(id,hash,revision,state,now){const row=rows.get(id);if(!row||row.edit_hash!==hash||row.revision!==revision)return;Object.assign(row,{state,revision:revision+1,operator_at:now});return row;},async touch(id,hash,role,now,status){const row=rows.get(id);if(!row||row[role==='edit'?'edit_hash':'read_hash']!==hash)return;if(role==='edit')row.operator_at=now;else{row.output_at=now;row.output_status=status;}return row;}};}
const req=(method,action,session,key,body)=>({method,headers:{host:'camera.test',origin:'https://camera.test','content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},query:{action,session},body});
test('camera roles, conflicts, persistence and heartbeat timestamps across independent handlers',async()=>{
 const store=memoryStore();let clock=100000;const handler=createVirtualCameraHandler({store,now:()=>clock});const call=async(...args)=>{const res=response();await handler(req(...args),res);return res;};
 const created=await call('POST','create');assert.equal(created.code,201);const {id,key}=created.body;
 let read=await call('GET','state',id,key);const out=read.body.outputKey;assert.match(out,/^[a-f0-9]{48}$/);assert(!JSON.stringify(read.body).includes('edit_hash'));assert.notEqual(store.rows.get(id).edit_hash,key);assert.notEqual(store.rows.get(id).read_hash,out);
 assert.equal((await call('GET','state',id,'a'.repeat(48))).code,403);assert.equal((await call('GET','state',id)).code,403);
 const output=await call('GET','state',id,out);assert.equal(output.code,200);assert.equal(output.body.outputKey,undefined);
 assert.equal((await call('PUT','state',id,out,{revision:1,zoom:3})).code,403);assert.equal((await call('POST','heartbeat',id,out)).code,403);assert.equal((await call('POST','report',id,key)).code,403);
 const saved=await call('PUT','state',id,key,{revision:1,source:'https://vdo.ninja/?view=test&password=secret',zoom:3,x:.8,y:.4,smooth:true,venue:'Praha'});assert.equal(saved.code,200);assert.equal(saved.body.revision,2);assert.equal(saved.body.operatorAt,clock);
 assert.equal((await call('PUT','state',id,key,{revision:1,zoom:4})).code,409);assert.equal((await call('PUT','state',id,key,{revision:2,source:'https://evil.test/?view=a'})).code,400);
 clock+=9000;read=await call('GET','state',id,out);assert(read.body.serverNow-read.body.operatorAt>8000);
 await call('POST','heartbeat',id,key);read=await call('GET','state',id,out);assert.equal(read.body.serverNow-read.body.operatorAt,0);
 await call('POST','report',id,out,{status:'Výřez'});assert.equal((await call('GET','state',id,key)).body.outputStatus,'Výřez');
 const restarted=createVirtualCameraHandler({store,now:()=>clock});const restored=response();await restarted(req('GET','state',id,key),restored);assert.equal(restored.body.zoom,3);assert.equal(restored.body.venue,'Praha');assert.equal(restored.body.outputKey,out);
 const foreign=req('PUT','state',id,key,{revision:2,zoom:2});foreign.headers.origin='https://evil.test';const denied=response();await handler(foreign,denied);assert.equal(denied.code,403);
});
test('geometry remains inside the full 16:9 viewport; viewer URL whitelist',()=>{
 for(const zoom of [1,1.5,2,4,20,Infinity])for(const x of [-10,0,.5,1,10,NaN]){const c=crop({zoom,x,y:x});assert(c.x-.5/c.zoom>=-1e-9);assert(c.x+.5/c.zoom<=1+1e-9);assert(c.y-.5/c.zoom>=-1e-9);assert(c.y+.5/c.zoom<=1+1e-9);}assert.equal(crop({zoom:2,x:0}).x,.25);
 for(const url of ['javascript:alert(1)','https://evil.test/?view=a','https://vdo.ninja/?push=x','https://vdo.ninja/?view=a,b','https://vdo.ninja/?view=a&scene=1'])assert.throws(()=>sourceURL(url));const url=new URL(sourceURL('https://vdo.ninja/?view=a&password=secret&css=bad'));assert.equal(url.searchParams.get('password'),'secret');assert(!url.searchParams.has('css'));assert(url.searchParams.has('noaudio'));
});
test('production and preview use separate tables; missing storage fails without exposing errors',async()=>{
 assert.notEqual(cameraTable({VERCEL_ENV:'production'}),cameraTable({VERCEL_ENV:'preview'}));const h=createVirtualCameraHandler({store:{get:async()=>{throw Error('postgres://private-secret');}}});const r=response();await h(req('GET','state','a'.repeat(48),'b'.repeat(48)),r);assert.equal(r.code,503);assert(!JSON.stringify(r.body).includes('private-secret'));
});
