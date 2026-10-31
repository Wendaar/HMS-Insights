import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
await mkdir('artifacts/show-control',{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:390,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.addInitScript(()=>{window.testVoices=[];window.testSpoken=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>window.testVoices,addEventListener(){},cancel(){},pause(){},resume(){},speak(u){window.testSpoken.push(u);}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};});
 await page.route('**/api/studio?*',r=>r.fulfill({json:{organizations:[{code:'PHM',name:'PHM test'}],items:[]}}));
 let generations=0;const wav=await readFile('public/media/audio/shared/test-tone.wav');
 await page.route('**/api/show-speech?*',r=>{if(r.request().method()==='GET')return r.fulfill({json:{org:'PHM',configured:true}});generations++;assert.equal(r.request().headers().authorization,'Bearer test-code');const d=r.request().postDataJSON();assert.equal(d.language,'en');return r.fulfill({contentType:'audio/wav',body:wav});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/show-control?org=PHM');await page.waitForFunction(()=>!document.getElementById('org').disabled);
 await page.selectOption('#mode','test');await page.waitForFunction(()=>!document.getElementById('testTools').hidden);await page.locator('summary').filter({hasText:'Zvuk a hlasatel'}).click();
 assert.equal(await page.inputValue('#speechEngine'),'device');assert.match(await page.locator('#voiceInfo').textContent(),/nevrátil hlas/);
 await page.click('#voiceTest');assert.equal(await page.evaluate(()=>window.testSpoken.at(-1).lang),'cs-CZ');await page.click('#stop');
 await page.evaluate(()=>{window.testVoices=[{lang:'en_US',voiceURI:'english',name:'English fixture'}];});await page.selectOption('#language','en');assert.equal(await page.inputValue('#voice'),'english');await page.click('#voiceTest');assert.equal(await page.evaluate(()=>window.testSpoken.at(-1).lang),'en-US');assert.match(await page.evaluate(()=>window.testSpoken.at(-1).text),/Welcome/);
 await page.clock.fastForward(13000);assert.match(await page.locator('#notice').textContent(),/Hlas neodpovídá/);
 await page.fill('#testText','Goal for the home team.');await page.click('#addTest');await page.selectOption('#speechEngine','server');await page.fill('#speechCode','test-code');
 await page.locator('.event .play').click();await page.waitForFunction(()=>document.querySelector('.event .play').textContent.includes('Přehrát'));assert.equal(generations,1);assert.equal(await page.locator('.event').getAttribute('data-status'),'New');
 await page.locator('.event .play').click();await page.waitForFunction(()=>document.querySelector('.event')?.dataset.status==='Done');assert.equal(generations,1);
 await page.locator('.event .play').click();await page.click('#stop');assert.equal(await page.locator('.event').getAttribute('data-status'),'New');assert.equal(generations,1);
 await page.selectOption('#speechEngine','device');await page.reload();await page.waitForFunction(()=>!document.getElementById('org').disabled);assert.equal(await page.inputValue('#speechEngine'),'device');assert.equal(await page.inputValue('#language'),'en');assert.equal(await page.inputValue('#speechCode'),'');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('summary').filter({hasText:'Zvuk a hlasatel'}).click();await page.locator('#language').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/show-control/mobile-english.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'passed',checks:['device remains default','empty Android voice list can use system language','English locale and restored selection','stalled synthesis watchdog','server preparation requires second tap','native audio decode and completion','cached replay and STOP','code not stored','390px layout'],limitations:['synthetic original WAV substitutes provider; no live Azure account or physical Samsung tested']}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
