import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const directory=process.argv[2]??'artifacts/auto-camera';
const base='http://127.0.0.1:8766',origin='http://127.0.0.1:3015',results=[];
async function check(path,options,status){const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(4000)});assert.equal(r.status,status,path);results.push({path,status:r.status});return r;}
const health=await(await check('/health',{headers:{Origin:origin}},200)).json();assert.equal(health.supervision,'0.27.0');
await check('/health',{},403);
await check('/analyze',{method:'OPTIONS',headers:{Origin:'https://untrusted.invalid'}},403);
const preflight=await check('/analyze',{method:'OPTIONS',headers:{Origin:origin}},204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
await check('/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'bad'},415);
await check('/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'image/jpeg'},body:'bad'},400);
const image=await readFile(join(directory,'01.contact.jpg'));
const r=await check('/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'image/jpeg','X-Camera-Reset':'1'},body:image},200);const data=await r.json();assert(Array.isArray(data.tracks));assert(data.analysisMs>0);
for(const t of data.tracks){assert(Number.isFinite(t.officialScore));assert(Number.isFinite(t.playerScore));assert(t.officialScore>=0&&t.officialScore<=1);assert.equal(t.box.length,4);}
await writeFile(join(directory,'service-check.json'),JSON.stringify({health,results,analysisMs:data.analysisMs},null,2));console.log({health,checks:results.length});
