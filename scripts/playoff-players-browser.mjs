import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {server as app} from '../src/server.js';
import {createToolsHandler} from '../src/web/tools-handler.js';
import {bootstrapInstance,normalizePlayers,parseCsv} from '../src/app/playoff-players.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.PLAYOFF_TEST_OUTPUT||'artifacts/playoff-players';await mkdir(output,{recursive:true});
const records=new Map();
const store={async get(org,slug){return structuredClone(records.get(org+slug)??null);},async list(org){return [...records].filter(([k])=>k.startsWith(org)).map(([key,item])=>({slug:key.slice(org.length),title:item.draft.title,published:!!item.published}));},
  async save(org,slug,draft,revision,base){const old=records.get(org+slug);if((old?.revision??0)!==revision)return null;const item={draft,published:old?.published??base?.published??null,revision:revision+1};records.set(org+slug,item);return structuredClone(item);},
  async publish(org,slug,revision){const item=records.get(org+slug);if(!item||item.revision!==revision)return null;item.published=structuredClone(item.draft);item.revision++;return structuredClone(item);}};
const csv='Competition,Season,Phase,FirstName,LastName,Team,Team Id,Player Id,GP,G,A\nPHM Cup,2025-2026,Základní část,Adam,Novák,Tým A,a,adam,9,3,2\nPHM Cup,2025-2026,Základní část,Petr,Malý,Tým A,a,petr,8,1,0\nPHM Cup,2025-2026,Základní část,Jan,Neznámý,Tým B,b,jan,,0,0\nPHM Cup,2025-2026,Základní část,Tomáš,Dlouhé české jméno,Tým B,b,tomas,16,4,6';
const handler=createToolsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'browser-test-only',DATABASE_URL:'test-only'},store,readSource:async config=>{
  if(config.source.sheetName==='Broken')throw new Error('Google tabulka není dostupná.');
  return {...normalizePlayers(parseCsv(csv),config),readAt:'2026-10-23T10:00:00Z',sourceLabel:'Testovací data · průchod aplikací'};
}});
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/api/tools'){app.emit('request',req,res);return;}
  req.query=Object.fromEntries(url.searchParams);let body='';for await(const chunk of req)body+=chunk;req.body=body||undefined;
  await handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},json(value){res.setHeader('content-type','application/json');res.end(JSON.stringify(value));}});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root+'/tools/playoff-players/phm/phm-cup-2026');await page.locator('.player').last().waitFor();
  assert.equal(await page.locator('.topbar, footer, #manager, #duplicate-dialog').count(),0);
  assert.equal(await page.locator('a[href*="/control"]').count(),0);
  assert.equal(await page.locator('.player').count(),4);assert.match(await page.locator('[class="badge unknown"]').textContent(),/Nelze ověřit/);
  await page.fill('#player-search','novak');assert.equal(await page.locator('.player').count(),1);await page.fill('#player-search','');
  await page.selectOption('#eligibility-filter','eligible');assert.equal(await page.locator('.player').count(),2);await page.selectOption('#eligibility-filter','all');
  await page.screenshot({path:output+'/public-desktop.png'});
  await page.goto(root+'/control/apps/playoff-players?org=phm');await page.fill('#secret','browser-test-only');await page.locator('#unlock-form button').click();await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#secret').inputValue(),'');
  await page.fill('#min-starts','12');assert.equal(await page.locator('#publish').isEnabled(),false);await page.click('#preview');await page.locator('.player').last().waitFor();
  assert.equal(await page.locator('.badge.eligible').count(),1);assert.equal(await page.locator('#preview-label').isVisible(),true);
  let publicResponse=await page.request.get(root+'/api/tools?org=phm&instance=phm-cup-2026');assert.equal((await publicResponse.json()).config.minStarts,9);
  await page.click('#save');await page.locator('#admin-message').filter({hasText:'Pracovní verze je uložená'}).waitFor();
  publicResponse=await page.request.get(root+'/api/tools?org=phm&instance=phm-cup-2026');assert.equal((await publicResponse.json()).config.minStarts,9);
  await page.click('#publish');await page.locator('#admin-message').filter({hasText:'je publikované'}).waitFor();
  publicResponse=await page.request.get(root+'/api/tools?org=phm&instance=phm-cup-2026');assert.equal((await publicResponse.json()).config.minStarts,12);
  // A new browser context reads central publication, without the management key.
  const viewer=await browser.newPage({viewport:{width:390,height:844}});await viewer.goto(root+'/tools/playoff-players/phm/phm-cup-2026?embed=1');await viewer.locator('.player').last().waitFor();
  assert.equal(await viewer.locator('.topbar, footer, #manager, a[href*="/control"]').count(),0);assert.equal(await viewer.locator('.badge.eligible').count(),1);
  assert.equal(await viewer.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await viewer.evaluate(()=>getComputedStyle(document.querySelector('main')).padding),'0px');
  assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await viewer.screenshot({path:output+'/public-mobile.png'});
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+'/manager-desktop.png'});
  await page.click('#duplicate');await page.fill('#new-title','Hráči pro playoff 2027');await page.fill('#new-slug','phm-cup-2027');await page.locator('#duplicate-form button').first().click();await page.locator('#admin-message').filter({hasText:'Nová pracovní verze'}).waitFor();
  assert.match(await page.locator('#publication-state').textContent(),/není publikovaný/);
  assert.equal((await page.request.get(root+'/api/tools?org=phm&instance=phm-cup-2027')).status(),404);
  await page.fill('#sheet','Broken');await page.click('#preview');await page.locator('#admin-message').filter({hasText:'Google tabulka není dostupná'}).waitFor();
  await page.fill('#sheet','Players_Stats');await page.click('#save');await page.locator('#admin-message').filter({hasText:'Pracovní verze je uložená'}).waitFor();
  await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:output+'/manager-mobile.png'});
  const iframe=await page.locator('#embed-code').inputValue();assert.match(iframe,/phm-cup-2027\?embed=1/);assert.doesNotMatch(iframe,/browser-test-only/);
  await viewer.goto(root+'/tools/playoff-players/yhg/phm-cup-2026');await viewer.locator('#data-error').filter({hasText:'není publikovaný'}).waitFor();assert.equal(await viewer.locator('.player').count(),0);
  assert.deepEqual(errors,[]);console.log('Playoff app browser checks passed: draft/public separation, persisted publication, duplicate, filters, errors, org isolation, mobile, embed.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
