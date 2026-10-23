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
  // PNG export is separate; OBS and its preview must work without the export CDN.
  await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await context.route('**/api/broadcast?*',route=>{
    reads++;const q=new URL(route.request().url()).searchParams;nextRead?.();nextRead=null;
    if(failed)return route.fulfill({status:503,json:{error:'Test: HMS nedostupné.'}});
    if(q.has('gameId'))return route.fulfill({json:fixture});
    return route.fulfill({json:{org:'EUCHL',items:[{gameId:id,playedOn:'2026-10-23',startTime:'21:15:00',home:fixture.home,away:fixture.away}],hasMore:false,source:'HMS'}});
  });
  await page.goto(root+`/broadcast/index.html?org=EUCHL&game=${id}`);await page.locator('#current-obs-url').waitFor();
  const obs=await page.locator('#current-obs-url').inputValue();assert.equal(new URL(obs).searchParams.get('game'),id);assert.equal(new URL(obs).searchParams.get('org'),'EUCHL');
  assert.equal(sheets,0);assert.match(await page.locator('#connection-status').textContent(),/HMS API/);
  const preview=page.locator('.preview-frame iframe');
  await preview.waitFor();
  await page.waitForFunction(()=>document.querySelector('.preview-frame iframe')?.contentWindow?.innerWidth===1920);
  assert.deepEqual(await preview.evaluate(el=>({width:el.contentWindow.innerWidth,height:el.contentWindow.innerHeight})),{width:1920,height:1080});
  assert.ok(Math.abs((await preview.boundingBox()).width-await page.locator('.preview-frame').evaluate(el=>el.clientWidth))<1);
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
  await page.waitForFunction(()=>Math.abs(document.querySelector('.preview-frame iframe').getBoundingClientRect().width-document.querySelector('.preview-frame').clientWidth)<1);
  // Live layers use a deterministic recorded-game fixture, never fabricated production data.
  fixture.status='FINISHED';
  fixture.match={score:{home:3,away:1},coverage:'matches-score',ordered:true,lineupAvailable:true,
    periods:[{period:1,home:2,away:0},{period:2,home:1,away:1},{period:3,home:0,away:0}],
    roster:Array.from({length:47},(_,i)=>({id:'player-'+i,name:`Player ${i+1}`,side:i<25?'home':'away',number:i+1,goalie:i===0})),
    goals:Array.from({length:4},(_,i)=>({id:'goal-'+i,side:i<3?'home':'away',period:i<2?1:2,clock:`${i+1}:00`,scorer:{id:'player-0',name:'Test Scorer'},assists:[{name:'Test Assist'}],scoreAfter:{home:Math.min(i+1,3),away:i===3?1:0}})),
    insights:[{id:'player-0',name:'Test Scorer',side:'home',goals:3,assists:1,points:4,type:'hat-trick'}]};
  await page.setViewportSize({width:1067,height:929});
  await page.selectOption('#language','en');await page.waitForURL('**lang=en**');await page.locator('#layer').waitFor();
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/broadcast?')&&r.url().includes('gameId=')),page.locator('#refresh-data').click()]);
  await page.waitForTimeout(50);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.match(await page.locator('#game-form button').textContent(),/Load game/);
  await page.selectOption('#layer','lineup');await page.selectOption('#layer-side','away');await page.selectOption('#layer-page','2');
  let layerUrl=await page.locator('#current-obs-url').inputValue();assert.equal(new URL(layerUrl).searchParams.get('lang'),'en');assert.equal(new URL(layerUrl).searchParams.get('side'),'away');
  await page.waitForFunction(()=>document.querySelector('#preview')?.contentDocument?.querySelector('[data-layer="lineup"]'));
  await page.screenshot({path:output+'/layers-control.png'});
  await page.setViewportSize({width:1920,height:1080});await page.goto(layerUrl);await page.locator('[data-layer="lineup"]').waitFor();
  assert.equal(await page.locator('.roster-list li').count(),2);assert.match(await page.locator('h1').textContent(),/Lineup/);assert.match(await page.locator('.page-label').textContent(),/Page 2/);
  const view=new URL(layerUrl);view.searchParams.set('page','1');view.searchParams.set('side','both');await page.goto(view.href);await page.locator('.roster-list').first().waitFor();
  assert.equal(await page.locator('.roster-list li').count(),24);await page.screenshot({path:output+'/lineups.png',omitBackground:true});
  for(const layer of ['periods','scoresheet','insights']){
    view.searchParams.set('layer',layer);view.searchParams.set('period','1');await page.goto(view.href);await page.locator(`[data-layer="${layer}"]`).waitFor();
    assert.equal(await page.locator('button,a,input').count(),0);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    if(layer==='periods'){assert.match(await page.locator('.period-score').textContent(),/2 : 0/);assert.match(await page.locator('.score-caption').textContent(),/After period 1/);}
    if(layer==='scoresheet'){assert.equal(await page.locator('.goal-list li').count(),4);assert.match(await page.locator('.goal-list').textContent(),/Test Assist/);}
    if(layer==='insights'){assert.match(await page.locator('.insight-title').textContent(),/Hat trick/);const box=await page.locator('.compact-layer').boundingBox();assert.ok(box.width<1000&&box.height<600);}
    assert.equal(await page.locator('.match-layer').evaluate(el=>el.scrollHeight<=el.clientHeight),true);
    await page.screenshot({path:output+'/'+layer+'.png',omitBackground:true});
  }
  // An achievement removed/corrected in HMS must disappear on the next refresh.
  fixture.match.insights=[];await page.clock.fastForward(15000);await page.getByText('No hat trick or multi-point performance yet',{exact:true}).waitFor();
  assert.equal(sheets,0);assert.ok(reads>0);assert.deepEqual(errors,[]);
  console.log('Broadcast browser checks passed: pregame regression, CZ/EN controls, stable OBS URLs, lineup pagination, periods, scoresheet, compact insight and correction refresh, transparent 1080p, no Sheet.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
