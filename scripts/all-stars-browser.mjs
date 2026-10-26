// Browser-only test fixtures are explicitly labelled; no demo enters production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {server as app} from '../src/server.js';
import {createAllStarsHandler} from '../src/web/all-stars-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,season=id(10),group=id(11),candidates={F:[],D:[],G:[]};let n=1;
for(const [role,count]of Object.entries({F:3,D:2,G:1}))for(let i=0;i<count;i++){const playerId=id(n++);candidates[role].push({id:playerId+'|'+id(20),playerId,teamId:id(20),team:'TEST fixture team',name:`TEST fixture ${role}${i}`,role,gp:2,points:4,goals:2,assists:2,pim:0,sv:role==='G'?.9:null,saves:18,ga:2,coverage:1,eligible:true,positionUnverified:false,score:10});}
const entries=new Map();
const store={async get(o,s){return structuredClone(entries.get(o+':'+s)??null);},async list(o){return [...entries].filter(([k])=>k.startsWith(o+':')).map(([k,v])=>({slug:k.split(':')[1],title:v.draft.title,published:!!v.published}));},async save(o,s,d,rev){const k=o+':'+s,old=entries.get(k);if((old?.revision??0)!==rev)return null;const item={draft:structuredClone(d),published:old?.published??null,revision:rev+1};entries.set(k,item);return structuredClone(item);},async publish(o,s,rev){const item=entries.get(o+':'+s);if(!item||item.revision!==rev)return null;item.published=structuredClone(item.draft);item.revision++;return structuredClone(item);}};
const handler=createAllStarsHandler({env:{DATABASE_URL:'TEST',HMS_PHM_TOOLS_ADMIN_SECRET:'test-access',HMS_PHM_ORGANIZATION_ID:id(99),HMS_EUCHL_ORGANIZATION_ID:id(98)},store,loadLeagues:async org=>[{organization_id:org,season_id:season,competition_name:'TEST competition',season_name:'TEST 2026'}],readAllStars:async(org,q)=>({org,scope:{seasonId:season,groupId:group,month:q.month},candidates,groups:[{id:group,name:'TEST division'}],season:{name:'TEST competition · TEST 2026'},coverage:{expected:2,imported:2,usable:2,missing:[],unsuitable:0,complete:true},monthClosed:true,source:'TEST fixtures',readAt:'2026-10-01',rules:'calendar-manual-v1'})});
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/all-stars'){req.query=Object.fromEntries(url.searchParams);if(req.method==='POST'){let b='';for await(const c of req)b+=c;req.body=b;}return handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(c){res.statusCode=c;return this;},json(v){res.setHeader('content-type','application/json');res.end(JSON.stringify(v));}});}app.emit('request',req,res);});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.ALL_STARS_TEST_OUTPUT||'artifacts/all-stars';await mkdir(out,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/control/apps/all-stars?org=phm&lang=cs');await page.locator('#season option').nth(1).waitFor({state:'attached'});
 await page.selectOption('#season',season);await page.fill('#month','2026-09');await page.click('#load');await page.locator('.candidate').first().waitFor();
 assert.match(await page.locator('#coverage').innerText(),/2 \/ 2/);assert.equal(await page.locator('#manager input[placeholder*="UID"]').count(),0);
 for(const role of ['F','D','G']){await page.click(`[data-role="${role}"]`);for(let i=0;i<candidates[role].length;i++)await page.locator('.candidate').nth(i).click();}
 assert.equal(await page.locator('#lineup .slot').count(),6);assert.equal(await page.locator('#publish').isDisabled(),true);
 const png=page.waitForEvent('download');await page.click('#png');assert.match((await png).suggestedFilename(),/\.png$/);
 const json=page.waitForEvent('download');await page.click('#json');const downloaded=await json;await downloaded.saveAs(out+'/lineup.json');await page.click('#clear');assert.equal(await page.locator('#lineup .slot').count(),0);await page.setInputFiles('#import',out+'/lineup.json');await page.locator('#lineup .slot').nth(5).waitFor();
 await page.fill('#slug','2026-09-test');await page.fill('#code','test-access');await page.click('#restore');await page.waitForFunction(()=>document.getElementById('status').textContent==='');
 await page.fill('#title','TEST All Stars');await page.click('#save');await page.getByRole('status').filter({hasText:'Pracovní verze uložena.'}).waitFor();assert.equal(await page.locator('#publish').isDisabled(),false);
 await page.fill('#title','TEST unsaved');assert.equal(await page.locator('#publish').isDisabled(),true);await page.fill('#title','TEST All Stars');
 await page.click('#publish');await page.locator('#public-link').waitFor();assert.equal(await page.locator('#public-link').getAttribute('href'),'https://app.phmcup.cz/all-stars/phm/2026-09-test?lang=cs');assert.match(await page.inputValue('#embed'),/https:\/\/app.phmcup.cz/);
 await page.screenshot({path:out+'/manager-cs.png',fullPage:true});
 const publicPage=await browser.newPage();await publicPage.goto(root+'/all-stars/phm/2026-09-test?lang=en');await publicPage.locator('#public-lineup .slot').nth(5).waitFor();assert.equal(await publicPage.locator('#manager').isVisible(),false);assert.match(await publicPage.locator('#public-lineup').innerText(),/Forwards/);await publicPage.screenshot({path:out+'/public-en.png',fullPage:true});
 await page.reload();await page.locator('#season option').nth(1).waitFor({state:'attached'});assert.equal(await page.inputValue('#code'),'');await page.fill('#slug','2026-09-test');await page.fill('#code','test-access');await page.click('#restore');await page.locator('#lineup .slot').nth(5).waitFor();assert.equal(await page.inputValue('#title'),'TEST All Stars');
 await page.selectOption('#org','euchl');await page.waitForFunction(()=>document.getElementById('access-status').textContent.includes('nemá')||document.getElementById('access-status').textContent.includes('čeká'));assert.equal(await page.inputValue('#code'),'');assert.equal(await page.locator('#lineup .slot').count(),0);assert.equal(await page.locator('#public-link').isVisible(),false);
 await page.goto(root+'/control/apps/all-stars?org=phm&lang=en');await page.locator('#season option').nth(1).waitFor({state:'attached'});assert.equal(await page.locator('#load').innerText(),'Load from HMS');await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/mobile-en.png',fullPage:true});
 await publicPage.goto(root+'/all-stars/euchl/2026-09-test?lang=en');await publicPage.locator('#status').filter({hasText:'not been published'}).waitFor();
 assert.deepEqual(errors,[]);console.log('All Stars browser QA passed: CS/EN, 3+2+1, PNG/JSON, save/restore/publish, immutable public output, organization isolation, mobile.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
