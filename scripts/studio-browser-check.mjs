// Run with Playwright installed, or PLAYWRIGHT_MODULE pointing to its ESM entry.
// Uses synthetic API responses to verify UI/export independently of credentials.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { server } from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}:{} )});
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/hms-studio-browser';await mkdir(output,{recursive:true});
const gameId='f6321894-98ca-11f1-8bdf-ef2495d048f3';
const fixture={gameId,org:'PHM',status:'FINISHED',playedOn:'2026-10-21',competition:'PHM Cup',group:'SUPER',phase:'Základní část',home:{name:'Hc Slavoj Zbraslav – mimořádně dlouhý název týmu s češtinou',score:5},away:{name:'HC Kosti',score:10},timeline:{coverage:'matches-result',periodScores:[{period:1,home:2,away:3},{period:2,home:2,away:4},{period:3,home:1,away:3}]},readAt:new Date().toISOString(),source:'browser-test-fixture'};
try {
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const logoData=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=40;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,40,40);return c.toDataURL('image/png');});
  fixture.home.logoUrl='https://example.com/home-logo.png';
  await page.route('https://example.com/home-logo.png',route=>route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(logoData.split(',')[1],'base64')}));
  await page.route('**/api/studio?*',async route=>{
    const q=new URL(route.request().url()).searchParams;
    if(q.get('org')!=='PHM')return route.fulfill({status:503,json:{error:'Test: organizace nepřipojena.'}});
    if(q.has('gameId'))return route.fulfill({json:fixture});
    const insights=q.get('section')==='insights';
    await route.fulfill({json:{items:insights?[{id:'test-insight',gameId,title:'Hattrick Hero',text:'Adam Patočka zaznamenal hattrick.',player:'Adam Patočka',type:'HATTRICK',date:'2026-10-21'}]:[{gameId,playedOn:'2026-10-21',status:'FINISHED',home:fixture.home,away:fixture.away}],from:'2026-10-21',to:'2026-10-21',source:'browser-test-fixture',hasMore:q.get('offset')==='0'}});
  });
  await page.goto(root+'/studio');await page.locator('.match').click();await page.locator('#download').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('download').disabled);
  const pixel=await page.evaluate(()=>Array.from(document.getElementById('canvas').getContext('2d').getImageData(280,Math.floor(1080*.46),1,1).data));
  assert.deepEqual(pixel,[255,0,0,255]);
  for(const format of ['1:1','9:16']) {
    await page.selectOption('#format',format);
    for(const font of ['Roboto','Roboto Condensed','Roboto Slab','Noto Sans','Noto Serif']) {
      await page.selectOption('#font',font);await page.waitForFunction(()=>!document.getElementById('download').disabled);
      const event=page.waitForEvent('download');await page.click('#download');const download=await event;const path=`${output}/${format.replace(':','x')}-${font.replaceAll(' ','-')}.png`;await download.saveAs(path);
      const png=await readFile(path);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),format==='1:1'?1080:1920);assert.ok(png.length>20000);
    }
  }
  await page.selectOption('#template','period-2');await page.waitForFunction(()=>!document.getElementById('download').disabled);
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  await page.fill('#partner','ODIN');await page.locator('#partner').dispatchEvent('change');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:output+'/mobile.png',fullPage:true});
  // Uploaded backgrounds work without CORS and get included in PNG.
  await page.setInputFiles('#upload',output+'/1x1-Roboto.png');await page.waitForFunction(()=>!document.getElementById('download').disabled);
  await page.fill('#background','https://example.com/unavailable.png');await page.route('https://example.com/unavailable.png',r=>r.abort());await page.locator('#background').dispatchEvent('change');
  await page.waitForFunction(()=>document.getElementById('warnings').textContent.includes('CORS'));assert.equal(await page.locator('#download').isDisabled(),true);
  await page.click('#clearBackground');await page.waitForFunction(()=>!document.getElementById('download').disabled);
  await page.click('#insights');await page.locator('.match').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);assert.equal(await page.locator('#template').inputValue(),'insight');
  await page.selectOption('#org','EUCHL');assert.equal(await page.locator('#partner').inputValue(),'');assert.equal(await page.locator('#download').isDisabled(),true);await page.locator('#list').getByText('Test: organizace nepřipojena.').waitFor();
  await page.selectOption('#org','PHM');assert.equal(await page.locator('#partner').inputValue(),'ODIN');
  assert.deepEqual(errors,[]);
  // Original real local report and feed routes remain functional.
  const report=await page.request.get(root+'/game-center/'+gameId);assert.equal(report.status(),200);
  const feed=await page.request.get(root+'/priklepy');assert.equal(feed.status(),200);
  console.log('Browser checks passed: 10 PNGs, 2 aspect ratios, 5 fonts, period/insight selection, CORS-enabled logo pixels, upload, CORS failure, 390px layout, per-org settings, report/feed.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
