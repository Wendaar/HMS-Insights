import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.BROADCAST_TEST_OUTPUT||'artifacts/broadcast';await mkdir(output,{recursive:true});
const id='6C02DF50-CE27-11F1-A5F0-6320901B5AD5';
const fixture={schemaVersion:1,org:'EUCHL',gameId:id,date:'2026-10-23',time:'21:15',status:'NOT PLAYED',home:{id:'365A02A0-C4FB-11F1-8AD4-9967CDC84598',name:'Prague Guardians'},away:{id:'2992D0D0-CE27-11F1-A5F0-6320901B5AD5',name:'Bratislava Capitals'},venue:'ICERINK (Yellow) - Prague CZ',competition:'European Union College Hockey League',group:'Division One',referee:null,timekeeper:null,readAt:'2026-10-23T10:00:00Z',source:'HMS API'};
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage(),errors=[];let failed=false,sheets=0,reads=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.url().includes('docs.google.com/spreadsheets'))sheets++;});let nextRead;
  await context.route('**/api/broadcast?*',route=>{
    reads++;const q=new URL(route.request().url()).searchParams;nextRead?.();nextRead=null;
    if(failed)return route.fulfill({status:503,json:{error:'Test: HMS nedostupné.'}});
    if(q.has('gameId'))return route.fulfill({json:fixture});
    return route.fulfill({json:{org:'EUCHL',items:[{gameId:id,playedOn:'2026-10-23',startTime:'21:15:00',home:fixture.home,away:fixture.away}],hasMore:false,source:'HMS'}});
  });
  await page.goto(root+`/broadcast/index.html?org=EUCHL&game=${id}`);await page.locator('#current-obs-url').waitFor();
  const obs=await page.locator('#current-obs-url').inputValue();assert.equal(new URL(obs).searchParams.get('game'),id);assert.equal(new URL(obs).searchParams.get('org'),'EUCHL');
  assert.equal(sheets,0);assert.match(await page.locator('#connection-status').textContent(),/HMS API/);
  await page.screenshot({path:output+'/control.png'});
  await page.clock.install();await page.goto(obs);await page.locator('.overlay-stage').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.locator('.team-block.home .team-name').textContent(),/Prague Guardians/);assert.match(await page.locator('.team-block.away .team-name').textContent(),/Bratislava Capitals/);
  assert.equal(await page.locator('.game-time').textContent(),'21:15');assert.equal(await page.locator('.neutral-frame').count(),1);
  assert.equal(await page.locator('img[src*="PHM"]').count(),0);assert.equal(await page.locator('button,a,input').count(),0);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
  for(const selector of ['.team-block.home','.team-block.away','.info-strip']){
    const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1920&&box.y+box.height<=1080,selector);
  }
  await page.screenshot({path:output+'/overlay.png',omitBackground:true});
  // Unchanged refresh must not replace the overlay or restart logo animations.
  await page.locator('.overlay-stage').evaluate(el=>el.dataset.marker='same-node');
  let refreshed=new Promise(resolve=>nextRead=resolve);await page.clock.fastForward(60000);await refreshed;await page.waitForTimeout(150);
  assert.equal(await page.locator('.overlay-stage').getAttribute('data-marker'),'same-node');
  failed=true;refreshed=new Promise(resolve=>nextRead=resolve);await page.clock.fastForward(60000);await refreshed;
  await page.waitForFunction(()=>document.body.dataset.connection==='stale');assert.equal(await page.locator('.overlay-stage').count(),1);
  failed=true;await page.goto(obs);await page.waitForFunction(()=>document.body.dataset.connection==='error');assert.equal(await page.locator('#app').textContent(),'');
  failed=false;await page.goto(root+`/broadcast/index.html?org=EUCHL&game=${id}&mode=thumbnail&clean=1`);await page.locator('.thumbnail-stage').waitFor();
  assert.equal(await page.locator('.download-floating').count(),0);assert.equal(await page.locator('.thumb-wordmark').textContent(),'EUCHL');
  await page.screenshot({path:output+'/thumbnail.png'});
  await page.goto(root+'/broadcast/index.html?org=EUCHL');await page.locator('#game-form').waitFor();
  await page.fill('#game-input',`https://prod.hms.wootera.net/org/euchl/games/${id}`);await page.locator('#game-form button').click();await page.waitForURL('**game='+id+'**');await page.locator('#current-obs-url').waitFor();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(sheets,0);assert.ok(reads>0);assert.deepEqual(errors,[]);
  console.log('Broadcast browser checks passed: exact fixture, transparent 1080p, EUCHL branding, picker, thumbnail, no Sheet, failure stays off air.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
