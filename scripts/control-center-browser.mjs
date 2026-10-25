import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.CONTROL_TEST_OUTPUT||'artifacts/control-center';
await mkdir(output,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/control');await page.locator('.node').last().waitFor();
 assert.equal(await page.locator('.node').count(),31);
 await page.getByRole('button',{name:'Nastavit kontext ↗'}).click();
 const id='f6321894-98ca-11f1-8bdf-ef2495d048f3';
 await page.fill('#league-name','Test PHM');await page.fill('#season-id',id);await page.fill('#game-id',id);
 await page.getByRole('button',{name:'Uložit kontext',exact:true}).click();
 assert.equal(await page.locator('[data-node="game-report"] a').getAttribute('href'),'/game-center/'+id);
 await page.selectOption('#organization','euchl');assert.equal(await page.locator('#game').inputValue(),'');
 await page.selectOption('#organization','phm');assert.equal(await page.locator('#game').inputValue(),id);
 await page.reload();assert.equal(await page.locator('#league').inputValue(),'Test PHM');
 await page.getByRole('button',{name:'Game Show Control',exact:true}).click();
 assert.match(await page.locator('#detail-phase').innerText(),/Planned/);assert.equal(await page.locator('#detail-links a').count(),0);
 await page.locator('#detail-dialog [data-close]').click();
 await page.click('#view-list');assert.equal(await page.locator('.list-card').count(),30);
 await page.fill('#search','porovnani tymu');assert.equal(await page.locator('.list-card').count(),1);
 await page.fill('#search','');await page.click('#view-map');
 await page.selectOption('#organization','yhg');assert.equal(await page.locator('.node a').count(),0);
 await page.selectOption('#organization','phm');
 await page.getByRole('button',{name:'Nastavit kontext ↗'}).click();await page.click('#clear-context');
 await page.screenshot({path:output+'/desktop-map.png',fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:output+`/mobile-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('Control map browser checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
