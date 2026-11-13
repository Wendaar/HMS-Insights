import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoDirector,settings} from '../public/virtual-camera/auto.js';
import {normalize} from '../public/virtual-camera/core.js';
import {cropSize} from '../public/virtual-camera/core.js';
import {readFile} from 'node:fs/promises';
import {cameraCSP} from '../public/virtual-camera/policy.js';
const track=(id,x,vx=0,y=.5)=>({id,x,y,vx,vy:0,confidence:.8,age:5,box:[x-.01,y-.04,.02,.04]});
test('AUTO ignores benches and invalid detections; empty video widens without random pan',()=>{
 const d=new AutoDirector({x:.65,zoom:2,y:.5});
 for(let t=0;t<10;t+=.25){const r=d.update({tracks:[track(1,.1,.2,.3),{...track(2,.4),vx:NaN}]},t);assert.equal(r.tracks.length,0);assert.equal(r.trackingState,'SAFE_WIDE');assert(Number.isFinite(r.x));}
 assert.equal(d.position.zoom,1);assert.equal(d.position.x,.5);assert.equal(d.position.y,.5);
});
test('isolated moving attacker can beat a larger inactive group; no instant candidate switch',()=>{
 const d=new AutoDirector();const tracks=[track(1,.35),track(2,.38),track(3,.4),track(4,.43),track(9,.75,.12)];
 let r;for(let i=0;i<20;i++)r=d.update({tracks},i*.25);
 assert(r.targetX>.7);assert(r.x>.5);assert(r.zoom>1);
});
test('low certainty holds last good region, then returns to wide; pan and zoom bounded',()=>{
 const d=new AutoDirector({zoom:1.8});let previous=d.position;
 for(let i=0;i<100;i++){
  const now=i*.25,r=d.update(i<30?{tracks:[track(1,.72,.035),track(2,.74,.03)]}:null,now);
  assert(Math.abs(r.x-previous.x)<=.16*.25+1e-9);assert(Math.abs(r.zoom-previous.zoom)<=.5*.25+1e-9);assert.equal(r.y,.5);previous=r;
  if(i===31)assert.equal(r.trackingState,'HOLD');
 }
 assert.equal(previous.trackingState,'SAFE_WIDE');assert.equal(previous.zoom,1);assert.equal(previous.x,.5);
});
test('calibration and AUTO preferences survive server normalization with safe bounds',()=>{
 const saved=normalize({zoom:2,autoSettings:{sensitivity:100,preferredZoom:4,calibration:{left:.1,right:.9,center:.55,top:.35,bottom:.72}}});
 assert.equal(saved.autoSettings.sensitivity,1);assert.equal(saved.autoSettings.preferredZoom,3);assert.equal(saved.autoSettings.calibration.center,.55);assert.equal(saved.zoom,2);assert(!('mode' in saved));assert.equal(settings().preferredZoom,1.8);
});
test('partial and invalid calibration remains ordered, including fallback values',()=>{
 const s=settings({calibration:{top:.8,left:.8,right:0,center:0}}).calibration;assert(s.bottom>s.top);assert(s.right>s.left);assert(s.center>=s.left);assert.doesNotThrow(()=>normalize({autoSettings:null}));
});
test('hosting permits only the local analyzer and snapshot/blob media; local server serves AUTO modules',async()=>{
 const hosting=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const policy=hosting.headers.find(h=>h.source==='/virtual-camera/:path*').headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.equal(policy,cameraCSP);assert(policy.includes("connect-src 'self' http://127.0.0.1:8766;"));
 const source=await readFile(new URL('../src/server.js',import.meta.url),'utf8');for(const file of ['auto.js','auto-settings.js','auto-client.js'])assert(source.includes("'"+file+"'"));
});
test('AUTO respects native panorama geometry, aspect changes, bounds and 16:9 output',()=>{
 const d=new AutoDirector({aspectRatio:32/9,zoom:2});let previous=d.position;
 for(let i=0;i<200;i++){
  const aspectRatio=i<150?32/9:16/9;
  const r=d.update(i<120?{tracks:[track(1,i<60?.12:.88,.035),track(2,i<60?.14:.86,.03)]}:null,i*.25,{aspectRatio});
  const size=cropSize({...r,aspectRatio});assert(r.x-size.width/2>=-1e-9);assert(r.x+size.width/2<=1+1e-9);assert(Math.abs((size.width/size.height)*aspectRatio-16/9)<1e-9);
  if(i<150)assert(Math.abs(r.x-previous.x)<=.16*.25+1e-9);previous=r;
 }
 assert.equal(previous.zoom,1);
});
