import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.SHOW_CONTROL_OUTPUT||'artifacts/show-control';await mkdir(output,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:360,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.showTest={spoken:[],tracks:[]};
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'test-cs',name:'Testovací český hlas',lang:'cs-CZ',localService:true}],addEventListener(){},cancel(){},pause(){},resume(){},speak(u){window.showTest.spoken.push(u);}}});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    window.Audio=class{constructor(){window.showTest.tracks.push(this);}async play(){this.paused=false;}pause(){this.paused=true;}removeAttribute(){}load(){}};
  });
  const id='11111111-1111-4111-8111-111111111111',home={id:'22222222-2222-4222-8222-222222222222',name:'Test domácí'},away={id:'33333333-3333-4333-8333-333333333333',name:'Test hosté'};
  let liveText='Gól týmu Test domácí. Střelec Jan Novák.',failed=false;
  await context.route('**/api/studio?*',route=>{
    const q=new URL(route.request().url()).searchParams;
    return route.fulfill({json:q.has('catalog')?{organizations:[{code:'PHM',name:'PHM · testovací fixture'},{code:'EUCHL',name:'EUCHL · testovací fixture'}]}:{source:'HMS',items:[{gameId:id,date:'2026-10-31',status:'RUNNING',home,away}],hasMore:false}});
  });
  await context.route('**/api/broadcast?*',route=>failed?route.fulfill({status:503,json:{error:'Testovaný výpadek API'}}):route.fulfill({json:{schemaVersion:1,org:new URL(route.request().url()).searchParams.get('org'),gameId:id,home,away,showControl:{events:[{id:'goal:1',type:'goal',side:'home',period:1,clock:'03:20',text:liveText}],types:['goal','penalty'],omitted:0}}}));
  await page.goto(root+'/studio/announcer');await page.locator('#org:not([disabled])').waitFor();
  await page.selectOption('#mode','test');await page.click('#addTest');assert.equal(await page.locator('.event').count(),1);
  await page.click('#duplicateTest');assert.equal(await page.locator('.event').count(),1);
  await page.locator('.event .play').click();assert.equal(await page.locator('.event').getAttribute('data-status'),'Playing');
  await page.click('#stop');assert.equal(await page.locator('.event').getAttribute('data-status'),'New');
  await page.evaluate(()=>window.showTest.spoken.at(-1).onend());assert.equal(await page.locator('.event').getAttribute('data-status'),'New');
  await page.locator('.event .play').click();await page.evaluate(()=>window.showTest.spoken.at(-1).onend());assert.equal(await page.locator('.event').getAttribute('data-status'),'Done');
  await page.fill('#testText','Opravený střelec. Petr Svoboda.');await page.click('#editTest');assert.equal(await page.locator('.event').getAttribute('data-status'),'New');assert.match(await page.locator('.event-meta').textContent(),/OPRAVENO/);
  await page.locator('.event .play').click();await page.evaluate(()=>window.showTest.spoken.at(-1).onend());
  await page.locator('summary').filter({hasText:'Zvuky a týmové profily'}).click();await page.selectOption('#profile','default');
  await page.locator('#upload').setInputFiles({name:'vlastni-horn.wav',mimeType:'audio/wav',buffer:Buffer.from('test fixture; playback is stubbed')});
  await page.waitForFunction(()=>!document.querySelector('[data-cue="goal-home"]').disabled&&!document.querySelector('[data-cue="goal-away"]').disabled);
  await page.locator('[data-cue="goal-home"]').click();assert.match(await page.locator('#now').textContent(),/GOAL HORN HOME/);
  await page.selectOption('#profile','team-home');await page.locator('#upload').setInputFiles({name:'domaci-horn.wav',mimeType:'audio/wav',buffer:Buffer.from('team fixture')});
  await page.waitForFunction(()=>document.querySelector('[data-cue="goal-home"]').textContent.includes('domaci-horn.wav'));
  assert.match(await page.locator('[data-cue="goal-away"]').textContent(),/vlastni-horn.wav/);
  await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.selectOption('#org','EUCHL');await page.waitForFunction(()=>document.querySelectorAll('.pad').length===7&&[...document.querySelectorAll('.pad')].every(b=>b.disabled));assert.equal(await page.locator('.event').count(),0);
  await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.selectOption('#org','PHM');await page.waitForFunction(()=>document.querySelector('.event')?.dataset.status==='Done');
  await page.locator('summary').filter({hasText:'Zvuky a týmové profily'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+'/manual-360.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.selectOption('#mode','live');await page.selectOption('#game',id);await page.waitForFunction(()=>document.getElementById('connection').dataset.state==='live');
  assert.equal(await page.locator('.event').count(),1);assert.equal(await page.locator('.event').getAttribute('data-status'),'New');
  await page.locator('.event .play').click();await page.evaluate(()=>window.showTest.spoken.at(-1).onend());await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('connection').dataset.state==='live');assert.equal(await page.locator('.event').getAttribute('data-status'),'Done');
  liveText='Gól týmu Test domácí. Opravený střelec Petr Svoboda.';await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('.event')?.dataset.status==='New'&&document.querySelector('.event-meta').textContent.includes('OPRAVENO'));
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+'/live-fixture-360.png',fullPage:true});
  failed=true;await page.locator('#matchSettings').evaluate(el=>el.open=true);await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('connection').textContent.includes('LIVE nedostupné'));assert.equal(await page.locator('.event .play').isDisabled(),true);
  await page.setViewportSize({width:320,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  // The unmocked local server must report actual unavailability, never a fabricated LIVE feed.
  const actual=await context.request.get(root+'/api/broadcast?org=PHM&gameId='+id+'&live=1');assert.equal(actual.status(),503);
  const report={result:'passed',widths:[320,360],checks:['manual TTS lifecycle and STOP cancellation','duplicate and edited event handling','reload and mode history isolation','team → organization/default asset fallback','organization isolation','LIVE fixture corrections and unavailable-state blocking','no horizontal overflow','no browser errors'],limitations:['API and speech/audio mocked in browser behavior checks','local unconfigured HMS endpoint verified as 503; no real live match or audible speech verified']};
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
