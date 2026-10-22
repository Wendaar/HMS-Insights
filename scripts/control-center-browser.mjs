import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.CONTROL_TEST_OUTPUT||'artifacts/control-center';
await mkdir(output,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Existing Game Report can request optional live media unavailable offline.
  page.on('console',msg=>{if(msg.type()==='error'&&new URL(page.url()).pathname.startsWith('/control'))errors.push(msg.text());});
  await page.goto(root+'/control');
  await page.locator('.card').last().waitFor();
  assert.equal(await page.locator('.card').count(),23);
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  await page.screenshot({path:output+'/desktop-overview.png'});
  await page.fill('#search','porovnani tymu');assert.equal(await page.locator('.card').count(),1);
  assert.match(await page.locator('.card h4').textContent(),/Porovnání týmů/);
  await page.fill('#search','');await page.getByRole('button',{name:'Data & Admin',exact:false}).click();
  await page.selectOption('#status','available');assert.equal(await page.locator('.card').count(),2);
  await page.fill('#search','nenajdes');assert.equal(await page.locator('#empty').isVisible(),true);
  await page.click('#reset');assert.equal(await page.locator('.card').count(),23);
  await page.fill('#game-id','not-an-id');await page.locator('#game-form button').click();
  assert.equal(await page.locator('#game-id').getAttribute('aria-invalid'),'true');
  assert.match(await page.locator('#game-error').textContent(),/platné Game ID/);
  const id='f6321894-98ca-11f1-8bdf-ef2495d048f3';
  await page.fill('#game-id',` ${id} `);assert.equal(await page.locator('#game-url').getAttribute('href'),`/game-center/${id}`);
  await page.locator('#game-form button').click();await page.waitForURL(`**/game-center/${id}`);
  assert.equal((await page.locator('h1').count())>0,true);
  await page.goto(root+'/control');
  await page.selectOption('#organization','yhg');await page.waitForURL('**/control?org=yhg');
  assert.equal(await page.locator('.card-links a').count(),0);assert.equal(await page.locator('#game-id').isDisabled(),true);
  await page.selectOption('#organization','fllh');await page.waitForURL('**/control?org=fllh');
  assert.equal(await page.locator('.card-links a').count(),0);
  assert.match(await page.locator('[data-app="phm-tv"] h4').textContent(),/FLLH TV/);
  await page.goBack();assert.equal(await page.locator('#organization').inputValue(),'yhg');
  await page.goBack();assert.equal(await page.locator('#organization').inputValue(),'phm');
  assert.equal(await page.locator('#game-id').isDisabled(),false);
  await page.goto(root+'/control?org=unknown');
  await page.locator('#organization-note').filter({hasText:'Neznámá organizace'}).waitFor();
  assert.equal(await page.locator('.card').count(),0);assert.equal(await page.locator('#game-id').isDisabled(),true);
  await page.selectOption('#organization','phm');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`${output}/mobile-${width}.png`,fullPage:true});
    await page.screenshot({path:`${output}/mobile-${width}-overview.png`});
  }
  // Every local navigation target is an existing GET route; no admin POST runs here.
  const links=await page.locator('.card-links a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).filter(h=>h.startsWith('/')));
  for(const href of links){const r=await page.request.get(root+href);assert.ok([200,503].includes(r.status()),`${href}: ${r.status()}`);}
  assert.deepEqual(errors,[]);
  console.log('Control Center browser checks passed (desktop, 390px, 320px, org isolation, filters, Game Report).');
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
