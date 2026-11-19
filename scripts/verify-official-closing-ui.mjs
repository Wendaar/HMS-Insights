// Optional real-browser integration check. Supply a Playwright index.mjs path
// as argv[2], or install Playwright in the development environment.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createOfficialClosingHandler} from '../src/web/official-closing-handler.js';
import {createPublicPortalHandler} from '../src/web/public-portal-handler.js';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const scope={organization:'phm',competitionId:id(10),seasonId:id(11),type:'group',groupId:id(12)};
const teams=[{id:id(20),name:'Alpha HC'},{id:id(21),name:'Beta HC'}];
const players=[{id:id(30),playerId:id(30),teamId:id(20),name:'Alice Hockey',role:'skater',games:3,points:6,goals:4,assists:2},{id:id(31),playerId:id(31),teamId:id(21),name:'Bob Goalie',role:'goalie',games:3}];
const rows=new Map(),store={async get(o,s){return structuredClone(rows.get(o+s)??null);},async list(o){return [...rows].filter(([k])=>k.startsWith(o)).map(([k,v])=>({slug:k.slice(o.length),title:v.draft.config?.title}));},async save(o,s,d,r){const old=rows.get(o+s);if((old?.revision??0)!==r)return null;const next={revision:r+1,draft:structuredClone(d)};rows.set(o+s,next);return structuredClone(next);}};
const catalog={items:[{seasonId:scope.seasonId,competitionId:scope.competitionId,name:'Test tournament · 2026'}]};
const groups=[{id:scope.groupId,name:'Final group',phases:[{id:id(13),name:'Final phase'}]}];
const portalConfig={title:'Fixture portal',description:'',seasonIds:[scope.seasonId],defaultSeasonId:scope.seasonId,sections:['home'],color:'#087b91',lang:'cs',extras:'',widgets:[]};
const portal=createPublicPortalHandler({env:{HMS_PHM_ORGANIZATION_ID:id(1)},store:{async get(){return {published:portalConfig};}},closingStore:store,portalCatalog:async()=>catalog,portalBranding:async()=>({})});
const handler=createOfficialClosingHandler({env:{HMS_PHM_ORGANIZATION_ID:id(1),HMS_PHM_TOOLS_ADMIN_SECRET:'fixture-secret'},store,
 closingCatalog:async()=>catalog,closingContext:async()=>({groups}),closingSources:async(org,s)=>({scope:s,teams,players,suggestions:teams.map((t,i)=>({teamId:t.id,rank:i+1,medal:null})),nominations:{points:[{playerId:id(30),teamId:id(20),value:6}]},eligibility:{teamIds:teams.map(t=>t.id),playerTeamPairs:players},provenance:{source:'TEST FIXTURE',coverage:{membership:true,standings:true,skaters:true,goalies:true}}})});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/portal'){req.query=Object.fromEntries(url.searchParams);return portal(req,{setHeader:(k,v)=>res.setHeader(k,v),status(c){res.statusCode=c;return this;},json(d){res.setHeader('content-type','application/json');res.end(JSON.stringify(d));}});}
 if(url.pathname==='/api/closing'){
  req.query=Object.fromEntries(url.searchParams);if(req.method==='POST'){let body='';for await(const c of req)body+=c;req.body=body;}
  return handler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(c){res.statusCode=c;return this;},json(d){res.setHeader('content-type','application/json');res.end(JSON.stringify(d));}});
 }
 if(url.pathname==='/api/all-stars'){res.setHeader('content-type','application/json');return res.end('{"items":[]}');}
 if(url.pathname==='/'){
  res.setHeader('content-type','text/html');return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/league/app.css"><main class="manager"><div id="host"></div></main><script type="module">import {mountClosing} from "/league/closing.js";mountClosing(document.querySelector("#host"),{organization:()=>"phm",secret:()=>"fixture-secret"});</script>');
 }
 if(url.pathname==='/league/phm'){res.setHeader('content-type','text/html');return res.end(await readFile(new URL('../public/league/index.html',import.meta.url)));}
 if(/\.(js|css|svg|woff2)$/.test(url.pathname)){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'application/octet-stream');return res.end(await readFile(new URL('../public'+url.pathname,import.meta.url)));}
 res.statusCode=404;res.end();
 }catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.CLOSING_BROWSER_CHANNEL??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('[data-load]').click();await page.locator('[data-open]').click();
 await page.waitForSelector('[data-title]');const recordSlug=await page.locator('[data-slug]').inputValue();assert.match(recordSlug,/^closing-[a-f0-9]+$/);assert.equal(await page.locator('[data-version]').isDisabled(),true);assert.match(await page.locator('[data-no-version]').textContent(),/žádná verze/);
 await page.locator('[data-type]').selectOption('group');await page.locator('[data-sources]').click();await page.locator('[data-suggest]').click();
 assert.equal(await page.locator('[data-rank="0"]').inputValue(),'1');
 await page.locator('[data-move="1"][data-dir="-1"]').click();assert.equal(await page.locator('[data-rows] .order-row').first().locator('span').textContent(),'Beta HC');
 await page.locator('[data-award="mvp"]').selectOption(id(30)+'|'+id(20));
 await page.locator('[data-custom-code]').fill('fair-play');await page.locator('[data-custom-title]').fill('Fair Play');await page.locator('[data-custom]').click();
 await page.locator('[data-award="custom:fair-play"]').selectOption(id(30)+'|'+id(20));
 await page.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='Uloženo.');
 assert.equal(rows.get('PHM'+recordSlug).draft.config.awards.length,2);
 await page.locator('[data-final]').check();await page.locator('[data-review-button]').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='Ověřeno.');assert.equal(await page.locator('[data-final]').isChecked(),true);
 await page.locator('[data-approve]').click();await page.waitForFunction(()=>document.querySelector('[data-reopen]').disabled===false);
 assert.equal(rows.get('PHM'+recordSlug).draft.locked,true);assert.equal(await page.locator('[data-save]').isDisabled(),true);
 await page.locator('[data-publish]').click();await page.waitForFunction(()=>document.querySelector('[data-pause]').disabled===false);
 const published=await(await fetch(base+'/api/closing?org=phm&instance='+recordSlug)).json();assert.equal(published.version,1);assert.equal(published.standings[0].teamId,id(21));
 const out=new URL('../artifacts/closing-qa/',import.meta.url);await mkdir(out,{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('desktop.png',out)),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:fileURLToPath(new URL('mobile.png',out)),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile layout must not overflow');
 await page.locator('[data-reason]').fill('Correct reviewed placement');await page.locator('[data-reopen]').click();await page.waitForFunction(()=>document.querySelector('[data-save]').disabled===false);
 await page.locator('[data-title]').fill('Revised result');assert.equal(await page.locator('[data-approve]').isDisabled(),true);
 await page.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='Uloženo.');await page.locator('[data-final]').check();await page.locator('[data-approve]').click();await page.waitForFunction(()=>document.querySelector('[data-reopen]').disabled===false);
 assert.equal(rows.get('PHM'+recordSlug).draft.versions.length,2);assert.equal((await(await fetch(base+'/api/closing?org=phm&instance='+recordSlug)).json()).version,1);
 await page.locator('[data-pause]').click();await page.waitForFunction(()=>document.querySelector('[data-pause]').disabled===true);assert.equal((await fetch(base+'/api/closing?org=phm&instance='+recordSlug)).status,404);
 await page.goto(base+'/?lang=en');assert.equal(await page.locator('[data-load]').textContent(),'Load Closing');await page.locator('[data-load]').click();await page.locator('[data-slug]').fill('english-final');await page.locator('[data-open]').click();assert.equal(await page.locator('[data-save]').textContent(),'Save draft');
 await page.locator('[data-title]').fill('Published final result');await page.locator('[data-type]').selectOption('group');await page.locator('[data-sources]').click();await page.locator('[data-suggest]').click();
 await page.locator('[data-go-live]').click();assert.match(await page.locator('[role=status]').textContent(),/Confirm finality/);assert.equal(rows.has('PHMenglish-final'),false);
 await page.locator('[data-final]').check();await page.locator('[data-go-live]').click();await page.waitForFunction(()=>!!document.querySelector('[data-public-link]'));
 assert.equal(rows.get('PHMenglish-final').draft.publishedVersion,1);
 await page.goto(base+'/league/phm');await page.waitForSelector('.closing-result');assert.match(await page.locator('.closing-result').textContent(),/Published final result/);await page.locator('[data-section="closing"]').click();await page.waitForSelector('.closing-result');assert.match(await page.locator('.closing-result').textContent(),/Alpha HC/);
 assert.deepEqual(errors,[]);console.log('Closing browser integration passed: scope, suggestions, manual order, awards, custom awards, approval, publication, revision, privacy, mobile, CS/EN.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
