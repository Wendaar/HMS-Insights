// Synthetic authenticated-import checks. Never uses live credentials or writes a real DB.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createOrganizationImportHandler} from '../src/web/organization-import-handler.js';
import {createOrganizationImportPage} from '../src/web/organization-import-page.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const gameId='22222222-2222-2222-2222-222222222222',orgId='11111111-1111-1111-1111-111111111111';
const env={HMS_API_TOKEN:'PHM-API-TEST',HMS_WEBHOOK_SECRET:'PHM-SECRET-TEST',HMS_EUCHL_ORGANIZATION_ID:orgId,HMS_EUCHL_API_TOKEN:'EUCHL-API-TEST',HMS_EUCHL_WEBHOOK_SECRET:'EUCHL-SECRET-TEST'};
let writes=0;const requests=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
 if(url.pathname==='/organization-import.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(new URL('../public/organization-import.js',import.meta.url)));return;}
 const adapter={setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},send(body){res.end(body);},json(body){res.setHeader('content-type','application/json');res.end(JSON.stringify(body));}};
 if(url.pathname.startsWith('/api/admin/')){
  let body='';for await(const chunk of req)body+=chunk;req.body=body;
  requests.push({org:req.query.org,...JSON.parse(body)});
  await createOrganizationImportHandler({batch:url.pathname.endsWith('backfill'),env,now:new Date('2026-10-22T12:00Z'),ensureSchema:async()=>{},backfill:async options=>{
   assert.equal(options.config.token,env.HMS_EUCHL_API_TOKEN);assert.equal(options.expectedOrganizationId,orgId);const found=options.skip<2;if(found)writes++;
   return {discovered:found?1:0,processed:found?1:0,failed:0,skip:options.skip,nextSkip:options.skip+(found?1:0),done:!found,failures:[]};
  },processGame:async(id,options)=>{assert.equal(options.config.token,env.HMS_EUCHL_API_TOKEN);assert.equal(options.expectedOrganizationId,orgId);writes++;return {gameId:id,score:'9:3',priklepy:10};}})(req,adapter);return;
 }
 if(url.pathname.startsWith('/admin/')){createOrganizationImportPage({batch:url.pathname.endsWith('backfill'),env,now:new Date('2026-10-22T12:00Z')})(req,adapter);return;}
 res.statusCode=404;res.end('Not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}:{} )});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/admin/backfill?org=EUCHL');assert.equal(await page.locator('.org').innerText(),'EUCHL');assert.equal(await page.locator('#from').inputValue(),'2026-09-22');assert.equal(await page.locator('#to').inputValue(),'2026-10-22');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.fill('#secret',env.HMS_WEBHOOK_SECRET);await page.click('#submit');await page.waitForFunction(()=>document.getElementById('result').textContent.includes('Nesprávný'));assert.equal(writes,0);assert.equal(requests.length,1,'401 is not retried');assert.equal(await page.locator('#secret').inputValue(),'');
 await page.fill('#from','2026-09-01');await page.fill('#secret',env.HMS_EUCHL_WEBHOOK_SECRET);await page.click('#submit');await page.waitForFunction(()=>document.getElementById('result').textContent.includes('31 kalendářních'));assert.equal(requests.length,1,'oversized date window never posts');
 await page.fill('#from','2026-09-22');let transient=true;
 await page.route('**/api/admin/backfill?*',async route=>{if(transient){transient=false;return route.fulfill({status:503,json:{error:'Dočasná testovací chyba.'}});}return route.continue();});
 await page.click('#submit');await page.waitForFunction(()=>document.getElementById('result').textContent.includes('Úspěšně zpracováno: 2'),null,{timeout:30000});assert.equal(writes,2);assert.deepEqual(requests.slice(1).map(r=>r.skip),[0,1,2]);assert.ok(requests.every(r=>r.org==='EUCHL'));assert.equal(await page.locator('#secret').inputValue(),'');assert.match(await page.locator('#feed-link').getAttribute('href'),/^\/priklepy\/euchl\?refresh=\d+$/);assert.equal(await page.locator('#feed-link').isVisible(),true);
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('SECRET-TEST')),false);assert.equal(page.url().includes('SECRET'),false);
 await mkdir('/tmp/hms-org-import',{recursive:true});await page.screenshot({path:'/tmp/hms-org-import/completed-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'Import jednoho zápasu',exact:true}).click();await page.fill('#gameId',gameId);await page.fill('#secret',env.HMS_EUCHL_WEBHOOK_SECRET);await page.click('#submit');await page.waitForFunction(()=>document.getElementById('result').textContent.includes('vzniklo 10 Příklepů'));assert.equal(writes,3);assert.equal(await page.locator('#report-link').getAttribute('href'),'/game-center/'+gameId+'/public');assert.equal(await page.locator('#secret').inputValue(),'');assert.deepEqual(errors,[]);
 console.log('Organization import browser passed: scoped auth rejection, bounded dates, transient retry, two-game pagination + empty final page, scoped feed/report/navigation, no secret in URL/storage, clearing credentials, 390px mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
