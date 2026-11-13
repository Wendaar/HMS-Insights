// Synthetic two-window media regression. No stadium credentials or live VDO required.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let state={revision:1,source:'https://vdo.ninja/?view=synthetic',zoom:1,x:.5,y:.5,smooth:false,aspectRatio:16/9},report='',receivers=0;
const errors=[];
const fixture=`<body style="margin:0;background:black"><canvas width="2560" height="720" hidden></canvas><video autoplay muted playsinline style="width:100vw;height:100vh;object-fit:contain"></video><script>
const c=document.querySelector('canvas'),v=document.querySelector('video'),ctx=c.getContext('2d');let n=0;
function draw(){ctx.fillStyle='red';ctx.fillRect(0,0,1280,720);ctx.fillStyle='blue';ctx.fillRect(1280,0,1280,720);ctx.fillStyle='white';ctx.fillRect((n++*8)%2500,300,40,40);requestAnimationFrame(draw)}draw();v.srcObject=c.captureStream(25);
window.addEventListener('message',e=>{if(e.data.getStats&&!window.offline)e.source.postMessage({cib:e.data.cib,stats:{inbound:{synthetic:{video:{Resolution:'2560 x 720',_decodeFrames:v.getVideoPlaybackQuality().totalVideoFrames,_last_time:performance.now()}}}}},e.origin)});
parent.postMessage({action:'view-connection',value:true},'*');</script>`;
try{
 const ctx=await browser.newContext({viewport:{width:1920,height:1080}});
 await ctx.route('https://vdo.ninja/**',r=>{receivers++;return r.fulfill({contentType:'text/html',body:fixture})});
 await ctx.route('https://hero.test/**',async r=>{const u=new URL(r.request().url());if(u.pathname==='/api/virtual-camera'){
  const body=r.request().postDataJSON(),action=u.searchParams.get('action');
  if(r.request().method()==='PUT')state={...state,...body,revision:state.revision+1};
  if(action==='report')report=body.status;
  return r.fulfill({json:{...state,serverNow:Date.now(),operatorAt:Date.now(),outputAt:Date.now(),outputStatus:report,...(r.request().headers().authorization==='Bearer edit'?{outputKey:'read'}:{})}});
 }
 if(!u.pathname.startsWith('/virtual-camera'))return r.fulfill({status:204,body:''});
 const name=u.pathname.split('/').at(-1),file=name==='virtual-camera'?'index.html':name==='output'?'output.html':name;
 const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
 return r.fulfill({contentType:type,body:await readFile(new URL('../public/virtual-camera/'+file,import.meta.url))});});
 const operator=await ctx.newPage(),output=await ctx.newPage();for(const p of [operator,output])p.on('pageerror',e=>errors.push(e.message));
 await operator.goto('https://hero.test/virtual-camera#id=fixture&key=edit');
 await output.clock.install();await output.goto('https://hero.test/virtual-camera/output?id=fixture&key=read');
 await output.waitForFunction(()=>document.body.dataset.mediaStatus?.startsWith('Připojeno'));
 await operator.waitForFunction(()=>getComputedStyle(document.getElementById('wide')).aspectRatio.startsWith('3.555'));
 assert.equal(receivers,2,'each window loads its own VDO receiver');
 assert(await output.locator('iframe').evaluate(f=>new URL(f.src).searchParams.has('noaudio')),'normal browser must autoplay without audio');
 assert.equal(await output.evaluate(()=>location.search),'','legacy credentials migrate to the fragment');
 const viewport=await output.locator('#viewport').boundingBox();assert.equal(viewport.width,1920);assert.equal(viewport.height,1080);
 assert.equal(await output.locator('#diagnostics').isVisible(),false);
 await operator.locator('#wide').click({position:{x:20,y:100},force:true});
 await output.waitForFunction(()=>parseFloat(document.getElementById('media').style.left)>-1);
 const left=await output.screenshot();
 await operator.locator('#wide').click({position:{x:900,y:100},force:true});
 await output.waitForFunction(()=>parseFloat(document.getElementById('media').style.left)<-90);
 const right=await output.screenshot();assert.notDeepEqual(left,right,'rendered crops differ');
 await operator.locator('[data-zoom="2"]').click();
 await output.waitForFunction(()=>parseFloat(document.getElementById('media').style.width)>399);
 await operator.close();assert(await output.frames()[1].evaluate(()=>document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames>0));
 // Reject a same-origin message from the parent: only the actual VDO frame may report status.
 const before=await output.getAttribute('body','data-media-status');await output.evaluate(()=>window.postMessage({action:'view-connection',value:false},'*'));assert.equal(await output.getAttribute('body','data-media-status'),before);
 await output.frames()[1].evaluate(()=>{window.offline=true;parent.postMessage({action:'view-connection',value:false},'https://hero.test')});
 await output.clock.runFor(50);assert((await output.getAttribute('body','data-media-status')).startsWith('Odpojeno'));
 // Stop fixture metadata to model a broken receiver, then advance beyond retry deadline.
 await ctx.route('https://vdo.ninja/**',r=>{receivers++;return r.fulfill({contentType:'text/html',body:'<body>offline</body>'})});
 await output.clock.fastForward(12000);await output.clock.runFor(100);assert((await output.getAttribute('body','data-media-status')).startsWith('Čekání'));
 assert.equal(receivers,3);await output.clock.fastForward(65000);await output.clock.runFor(100);assert(receivers>=4,'retry repeats when first connection never succeeds');
 assert.deepEqual(errors,[]);
 const obs=await ctx.newPage();await obs.addInitScript(()=>{window.obsstudio={}});await obs.goto('https://hero.test/virtual-camera/output#id=fixture&key=read');await obs.locator('iframe').waitFor();
 assert(await obs.locator('iframe').evaluate(f=>!new URL(f.src).searchParams.has('noaudio')),'OBS runtime retains source audio');await obs.close();
 await mkdir(new URL('../test-output/virtual-camera/',import.meta.url),{recursive:true});
 await (await import('node:fs/promises')).writeFile(new URL('../test-output/virtual-camera/left.png',import.meta.url),left);
 await (await import('node:fs/promises')).writeFile(new URL('../test-output/virtual-camera/right.png',import.meta.url),right);
 console.log('PASS: independent video receivers, decoded synthetic frames, 1920x1080, panorama pan/zoom sync, hidden diagnostics, origin validation, repeated reconnect. Synthetic media only.');
}finally{await browser.close()}


