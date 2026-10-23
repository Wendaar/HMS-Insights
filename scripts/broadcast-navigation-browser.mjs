import assert from 'node:assert/strict';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const good='6C02DF50-CE27-11F1-A5F0-6320901B5AD5',bad='FC350BD0-CE26-11F1-A5F0-6320901B5AD5',past='89D62380-CAC0-11F1-99FA-E3FDDC4A94B4';
const team={name:'Prague Guardians'},away={name:'Bratislava Capitals'};
const detail={schemaVersion:1,org:'EUCHL',gameId:good,home:team,away,date:'2026-10-23',time:'21:15',source:'HMS API',readAt:'2026-10-23T13:00:00Z'};
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];let scheduleDown=false,detailDown=false,badReads=0;
  page.on('pageerror',e=>errors.push(e.message));await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());
  await context.route('**/api/broadcast?*',route=>{
    const q=new URL(route.request().url()).searchParams,id=q.get('gameId');
    if(id){if(id===bad)badReads++;if(detailDown||id===bad)return route.fulfill({status:503,json:{error:'Předzápasová data nejsou dostupná. Ověřte zápas a připojení vybrané organizace.'}});return route.fulfill({json:{...detail,gameId:id}});}
    if(scheduleDown)return route.fulfill({status:503,json:{error:'Seznam není dostupný.'}});
    const items=q.get('filter')==='Past'?[{gameId:past,playedOn:'2026-10-18',home:team,away}]:[{gameId:bad,playedOn:'2026-10-23',home:{},away:team},{gameId:good,playedOn:'2026-10-23',home:team,away}];
    return route.fulfill({json:{org:'EUCHL',items,hasMore:false}});
  });
  await page.goto(root+'/broadcast/index.html?org=EUCHL');await page.locator('#current-obs-url').waitFor();
  assert.equal(new URL(await page.locator('#current-obs-url').inputValue()).searchParams.get('game'),good);assert.equal(badReads,0);
  assert.equal(new URL(page.url()).searchParams.get('game'),good);
  async function filter(value){await Promise.all([page.waitForResponse(r=>r.url().includes('filter='+encodeURIComponent(value))),page.locator(`[data-filter="${value}"]`).click()]);await page.waitForTimeout(50);}
  await filter('Past');assert.equal(await page.locator(`[data-game="${past}"]`).count(),1);assert.equal(await page.locator(`[data-game="${good}"]`).count(),0);
  await filter('Tomorrow');await filter('Today');assert.equal(await page.locator('.match-card').count(),2);
  assert.equal(new URL(await page.locator('#current-obs-url').inputValue()).searchParams.get('game'),good);
  await page.locator(`[data-game="${bad}"]`).click();await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.includes('nejsou dostupná'));
  assert.equal(await page.locator('#game-form').count(),1);assert.equal(new URL(await page.locator('#current-obs-url').inputValue()).searchParams.get('game'),good);
  scheduleDown=true;await filter('Past');assert.match(await page.locator('#connection-status').textContent(),/Seznam zápasů se nepodařilo/);assert.equal(await page.locator('#current-obs-url').count(),1);
  scheduleDown=false;await filter('Today');await page.reload();await page.locator('#current-obs-url').waitFor();assert.equal(new URL(page.url()).searchParams.get('game'),good);
  // Failed detail on startup retains the list, filters and game-link form.
  detailDown=true;await page.goto(root+'/broadcast/index.html?org=EUCHL');await page.locator(`[data-game="${good}"]`).waitFor();
  assert.equal(await page.locator('#game-form').count(),1);assert.equal(await page.locator('.status-screen').count(),0);
  detailDown=false;await page.locator(`[data-game="${good}"]`).click();await page.locator('#current-obs-url').waitFor();
  // A failed schedule can still be bypassed with an explicit valid game link.
  scheduleDown=true;await page.goto(root+'/broadcast/index.html?org=EUCHL');await page.locator('#game-form').waitFor();
  await page.fill('#game-input',good);await page.locator('#game-form button').click();await page.locator('#current-obs-url').waitFor();
  assert.equal(new URL(await page.locator('#current-obs-url').inputValue()).searchParams.get('game'),good);assert.deepEqual(errors,[]);
  console.log('Navigation checks passed: incomplete first Today fixture, Past/Tomorrow/Today, retained selection, failed fixture/list recovery, refresh and manual game entry.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
