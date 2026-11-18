import test from 'node:test';
import assert from 'node:assert/strict';
import {decode,suppress,jerseyEvidence,BrowserTracker} from '../public/virtual-camera/detector-core.js';

test('YOLOX raw person output maps tile coordinates and rejects other classes',()=>{
 const data=new Float32Array(3549*85),row=10*52+20,at=row*85;
 data.set([.5,.5,Math.log(4),Math.log(8),.8,.9],at);
 // A high bicycle confidence must not be treated as a person.
 data.set([.5,.5,0,0,.9,0,.99],(row+1)*85);
 const result=decode(data,[1,3549,85],{width:1920,height:1080,x0:200,y0:100,ratio:.5});
 assert.equal(result.length,1);assert(Math.abs(result[0].confidence-.72)<1e-6);
 assert.deepEqual(result[0].box.map(Math.round),[496,204,560,332]);
 assert.throws(()=>decode(data,[1,85,3549],{}),/formát/);
});
test('overlapping tile detections retain the highest confidence once',()=>{
 const result=suppress([{box:[10,10,30,50],confidence:.5},{box:[11,10,31,50],confidence:.9},{box:[100,10,120,50],confidence:.8}]);
 assert.equal(result.length,2);assert.equal(result[0].confidence,.9);
});
test('striped grayscale torso is an official cue; saturated red remains a player',()=>{
 const w=80,h=100,pixels=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4,c=Math.floor(x/5)%2?230:20;pixels.set([c,c,c,255],at);}
 assert(jerseyEvidence(pixels,w,h,[0,0,w,h]).official>.7);
 for(let at=0;at<pixels.length;at+=4)pixels.set([220,30,20,255],at);
 const red=jerseyEvidence(pixels,w,h,[0,0,w,h]);assert.equal(red.official,0);assert.equal(red.player,1);
 assert.deepEqual(jerseyEvidence(pixels,w,h,[0,0,5,5]),{official:0,player:0});
});
const detection=(x,confidence=.9)=>({box:[x,100,x+40,200],confidence,evidence:{official:0,player:1}});
test('browser tracking keeps IDs and motion, expires missing actors and resets',()=>{
 const tracker=new BrowserTracker(),first=tracker.update([detection(200)],0,1000,500)[0];
 const next=tracker.update([detection(220)],.5,1000,500)[0];
 assert.equal(next.id,first.id);assert.equal(next.age,2);assert(next.vx>0);assert.equal(next.playerScore,1);
 assert.deepEqual(tracker.update([],1,1000,500),[]);
 assert.equal(tracker.update([detection(230)],2.5,1000,500)[0].age,1);
 tracker.reset();assert.equal(tracker.update([detection(200)],3,1000,500)[0].id,1);
});
test('one-to-one matching ignores low-confidence competitors',()=>{
 const tracker=new BrowserTracker();tracker.update([detection(200)],0,1000,500);
 const result=tracker.update([detection(200,.13),detection(210),detection(220)],.5,1000,500);
 assert.equal(result.length,2);assert.equal(new Set(result.map(t=>t.id)).size,2);
 assert.equal(result[0].id,1);assert.equal(result[0].age,2);assert.equal(result[1].age,1);
});
