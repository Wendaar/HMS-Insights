// Synthetic two-organization integration: real handlers + renderer + public/app.js.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createPublicFeedHandler} from '../src/web/public-feed-handler.js';
import {PHM_ORGANIZATION_ID} from '../src/app/organizations.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const env={HMS_EUCHL_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111'};
const fixture=(org,index)=>({id:`${org}-${index}`,type:'HATTRICK',title:'Hattrick '+org,text:'Výkon '+org,player:'Hráč '+org,team:org+' Home',homeTeam:org+' Home',awayTeam:org+' Away',homeScore:3,awayScore:1,gameId:'22222222-2222-2222-2222-222222222222',date:'2026-10-22',importance:95,group:org+' group',season:'2026/2027',facts:{goals:3}});
const calls=[];
const load=async params=>{calls.push(params);const org=params.organizationId===PHM_ORGANIZATION_ID?'PHM':'EUCHL',offset=Number(params.offset??0);return {items:offset<2?[fixture(org,offset)]:[],total:2,offset,hasMore:offset<1};};
const options={env,loadSelection:async params=>({...await load(params),hasMore:false}),loadPage:load,loadOptions:async params=>{const org=params.organizationId===PHM_ORGANIZATION_ID?'PHM':'EUCHL';return {groups:[org+' group'],teams:[org+' Home',org+' Away']};}};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
 if(['/app.js','/styles.css','/favicon.svg'].includes(url.pathname)){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'image/svg+xml');res.end(await readFile(new URL('../public'+url.pathname,import.meta.url)));return;}
 const page=/^\/(priklepy|archiv)(?:\/([a-zA-Z0-9-]+))?$/.exec(url.pathname);
 if(page||['/api/selection','/api/feed'].includes(url.pathname)){
  await createPublicFeedHandler({...options,html:!!page,mode:(page?page[1]==='archiv':url.pathname==='/api/feed')?'archive':'selection'})(req,{setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},send(body){res.end(body);},json(body){res.setHeader('content-type','application/json');res.end(JSON.stringify(body));}});return;
 }
 res.statusCode=404;res.end('Not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}:{} )});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/api\/(feed|selection)\?/.test(request.url()))requests.push(new URL(request.url()));});
 for(const org of ['PHM','EUCHL']){
  const suffix=org==='PHM'?'':'/euchl',foreign=org==='PHM'?'EUCHL':'PHM';
  await page.goto(root+'/priklepy'+suffix);assert.match(await page.title(),new RegExp(org));assert.match(await page.locator('#feed').innerText(),new RegExp(org+' Home'));assert.doesNotMatch(await page.locator('#feed').innerText(),new RegExp(foreign+' Home'));
  const filtered=page.waitForResponse(r=>r.url().includes('/api/selection?')&&new URL(r.url()).searchParams.get('q')==='player');await page.fill('#search','player');await filtered;await page.waitForFunction(org=>JSON.parse(document.getElementById('feed-data').textContent)[0].id.startsWith(org),org);
  await page.click('#filter-toggle');const grouped=page.waitForResponse(r=>r.url().includes('/api/selection?')&&new URL(r.url()).searchParams.get('group')===org+' group');await page.selectOption('[data-filter=group]',org+' group');await grouped;
  assert.doesNotMatch(await page.locator('#feed').innerText(),new RegExp(foreign+' Home'));
  const before=requests.length,more=page.waitForResponse(r=>r.url().includes('/api/feed?')&&Number(new URL(r.url()).searchParams.get('offset'))>0);await page.goto(root+'/archiv'+suffix);await page.locator('#feed-sentinel').scrollIntoViewIfNeeded().catch(()=>{});await more;
  const searched=page.waitForResponse(r=>r.url().includes('/api/feed?')&&new URL(r.url()).searchParams.get('q')==='player');await page.fill('#search','player');await searched;
  assert.ok(requests.slice(before).every(url=>url.searchParams.get('org')===org));assert.doesNotMatch(await page.locator('#feed').innerText(),new RegExp(foreign+' Home'));assert.equal(await page.getByRole('link',{name:'Výběr',exact:true}).getAttribute('href'),'/priklepy'+suffix);assert.equal(await page.getByRole('link',{name:'Archiv',exact:true}).getAttribute('href'),'/archiv'+suffix);
  await page.getByRole('link',{name:'Výběr',exact:true}).click();await page.waitForURL('**/priklepy'+suffix);assert.doesNotMatch(await page.locator('#feed').innerText(),new RegExp(foreign+' Home'));
 }
 // Root path is PHM even with conflicting query values.
 await page.goto(root+'/priklepy?feedOrg=EUCHL&org=EUCHL');assert.match(await page.title(),/PHM/);assert.doesNotMatch(await page.locator('#feed').innerText(),/EUCHL Home/);
 // A mismatched cached/incorrect response is not appended to another organization's page.
 await page.goto(root+'/priklepy/euchl');await page.route('**/api/selection?*',route=>route.fulfill({json:{organization:'PHM',items:[fixture('PHM',0)],total:1,hasMore:false,html:'<article>PHM Home</article>'}}));await page.fill('#search','mismatch');await page.waitForFunction(()=>document.getElementById('feed-sentinel').textContent.includes('Zdroj neodpovídá'));assert.doesNotMatch(await page.locator('#feed').innerText(),/PHM Home/);await page.unroute('**/api/selection?*');
 await page.setViewportSize({width:390,height:844});await page.goto(root+'/archiv/euchl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mkdir('/tmp/hms-feed-orgs',{recursive:true});await page.screenshot({path:'/tmp/hms-feed-orgs/euchl-mobile.png',fullPage:true});
 for(const path of ['/priklepy/unknown','/archiv/unknown','/api/feed?org=unknown','/api/selection?org=unknown'])assert.equal((await context.request.get(root+path)).status(),404);
 assert.ok(requests.some(url=>url.pathname==='/api/feed'&&url.searchParams.get('org')==='EUCHL'&&Number(url.searchParams.get('offset'))>0));assert.deepEqual(errors,[]);
 console.log('Public feed org browser passed: PHM/EUCHL SSR, search, filters, archive pagination/counts, scoped navigation and absolute assets, conflicting root queries, unknown org rejection, mismatched response protection, mobile 390px.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
