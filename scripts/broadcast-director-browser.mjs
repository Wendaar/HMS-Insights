// Deterministic acceptance tests. Fixtures never write HMS or a real OBS database.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {server} from '../src/server.js';
import {createChannelHandler} from '../src/web/broadcast-channel.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const id='6C02DF50-CE27-11F1-A5F0-6320901B5AD5',homeId='11111111-1111-1111-1111-111111111111',awayId='22222222-2222-2222-2222-222222222222',sponsorId='33333333-3333-3333-3333-333333333333';
const uuid=n=>`44444444-4444-4444-4444-${String(n).padStart(12,'0')}`;
const sponsorId2='55555555-5555-5555-5555-555555555555';
const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9d8AAAAASUVORK5CYII=';
const rows=new Map(),libraries=new Map();
const store={async create(id,hash,state){const row={id,control_hash:hash,state,revision:1};rows.set(id,row);return row;},async get(id){return rows.get(id);},async update(id,hash,revision,state){const row=rows.get(id);if(!row||row.control_hash!==hash||row.revision!==revision)return null;const next={...row,state,revision:revision+1};rows.set(id,next);return next;},async hide(id,hash){const row=rows.get(id);if(!row||row.control_hash!==hash)return null;const next={...row,state:{...row.state,visible:false,mainVisible:false,sponsors:{...row.state.sponsors,visible:false}},revision:row.revision+1};rows.set(id,next);return next;},async library(id){return libraries.get(id)??{items:[],revision:0};},async saveLibrary(id,hash,revision,items){if(rows.get(id)?.control_hash!==hash||(libraries.get(id)?.revision??0)!==revision)return null;const next={items,revision:revision+1};libraries.set(id,next);return next;}};
const handler=createChannelHandler({env:{HMS_EUCHL_ORGANIZATION_ID:homeId,HMS_EUCHL_API_TOKEN:'test',HMS_PHM_API_TOKEN:'test'},store});
const fixture=org=>({schemaVersion:1,org,gameId:id,date:'2026-11-26',time:'21:15',status:'FINISHED',home:{id:homeId,name:org+' Home · TEST'},away:{id:awayId,name:org+' Away · TEST'},source:'HMS API',readAt:'2026-11-26T13:00:00Z',competition:'TEST Competition',
 match:{coverage:'matches-score',ordered:true,score:{home:4,away:3},lineupAvailable:true,roster:Array.from({length:40},(_,i)=>({id:uuid(i+1),side:i<20?'home':'away',name:'Test Player '+i,number:i%20+1,goalie:i===0||i===20})),goals:Array.from({length:7},(_,i)=>({id:uuid(i+100),side:i%2?'away':'home',clock:`${i+1}:00`,period:1,scorer:{name:'Test Scorer '+i},assists:[{name:'Test Assistant A'},{name:'Test Assistant B'}],scoreAfter:{home:Math.ceil((i+1)/2),away:Math.floor((i+1)/2)}})),periods:[{period:1,home:4,away:3}],insights:[{id:uuid(2),name:'Test Player 1',side:'home',type:'multi-point',goals:1,assists:2,points:3}]},
 league:{leadersAvailable:true,standingsAvailable:true,leaders:Object.fromEntries(['home','away'].map(side=>[side,Array.from({length:5},(_,i)=>({id:uuid(i+1),name:'Test Leader '+i,goals:5-i,assists:i,points:5,games:3}))])),standings:[{id:homeId,name:'Test Home',rank:1,games:1,points:3},{id:awayId,name:'Test Away',rank:2,games:1,points:0}]},context:{historyAvailable:true,nextAvailable:true,teams:{home:{specialTeams:{available:true,ppPercentage:20,pkPercentage:80},results:[]},away:{specialTeams:{available:true,ppPercentage:20,pkPercentage:80},results:[]}},next:{home:[],away:[]}}});
let hmsFailure=false,zeroGoals=false,channelFailure=false,delayedShow=null;
let releaseInitialContext;const initialContext=new Promise(resolve=>releaseInitialContext=resolve);
const counts={channelGet:0,channelWrite:0,game:0,league:0,context:0,catalog:0,frameNavigations:0};
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
 const controlContext=await browser.newContext({viewport:{width:1440,height:1000}}),obsContext=await browser.newContext({viewport:{width:1920,height:1080}}),errors=[];
 controlContext.setDefaultTimeout(15000);obsContext.setDefaultTimeout(15000);
 for(const context of [controlContext,obsContext]){
  context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',frame=>{if(frame.parentFrame())counts.frameNavigations++;});});
  await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),q=Object.fromEntries(url.searchParams),org=q.org??'EUCHL';
   if(q.channel||q.channels){
    if(request.method()==='GET'){counts.channelGet++;if(channelFailure)return route.fulfill({status:503,json:{error:'Test channel offline'}});}else counts.channelWrite++;
    if(delayedShow&&request.method()==='PATCH'&&request.postDataJSON()?.state?.mainVisible){const wait=delayedShow;delayedShow=null;await wait;}
    let status=200,headers={};return handler({method:request.method(),headers:request.headers(),query:q,body:request.method()==='GET'?null:request.postDataJSON()},{setHeader(k,v){headers[k]=v;},status(code){status=code;return this;},json(body){return route.fulfill({status,headers,json:body});}});
   }
   if(url.pathname==='/api/studio')return route.fulfill({json:{organizations:['PHM','EUCHL'].map(code=>({code,slug:code.toLowerCase(),name:code,configured:true}))}});
   if(url.pathname==='/api/sponsors'){counts.catalog++;return route.fulfill({json:{org,items:[sponsorId,sponsorId2].map((id,i)=>({id,name:'TEST PARTNER '+i,claim:'Fixture · not production',web:'https://example.com',scopeRefs:{teamIds:[homeId]}})),bindings:[]}});}
   if(q.capabilities)return route.fulfill({json:{sandbox:true}});
   if(hmsFailure)return route.fulfill({status:503,json:{error:'TEST: HMS unavailable'}});
   if(q.gameId){counts[q.league?'league':q.context?'context':'game']++;const value=fixture(org);if(q.context){await initialContext;for(const side of ['home','away']){value.context.next[side]=[{date:'2026-11-28',time:'20:00',home:{name:'Next Home'},away:{name:'Next Away'}}];value.context.teams[side].results=[{date:'2026-11-20',result:'W',home:{name:'Previous Home',score:3},away:{name:'Previous Away',score:1}}];}}else if(!q.league){value.context=null;value.league=null;}if(zeroGoals){value.match.goals=[];value.match.score={home:0,away:0};}return route.fulfill({json:value});}
   return route.fulfill({json:{org,items:[{gameId:id,playedOn:'2026-11-26',startTime:'21:15',home:fixture(org).home,away:fixture(org).away}],hasMore:false}});
  });
 }
 const page=await controlContext.newPage();console.log('Opening V2 and selecting a game');await page.goto(base+'/broadcast/v2.html?org=EUCHL');
 await page.locator('#game-dialog[open]').waitFor();await page.locator('[data-game]').click();await page.waitForFunction(()=>!document.querySelector('#game-dialog').open);
 assert.equal(await page.locator('#test-banner').getAttribute('data-environment'),'sandbox');
 assert.match(await page.locator('#game-title').textContent(),/EUCHL Home/);
 assert.equal(await page.getByText('Fotografie hráče',{exact:true}).count(),0);
 await page.locator('#create-channel').click();await page.waitForFunction(()=>document.querySelector('#obs-url').value.includes('channel='));
 const url=await page.locator('#obs-url').inputValue(),channelId=new URL(url).searchParams.get('channel');assert.equal(rows.get(channelId).state.visible,false);
 libraries.set(channelId,{items:[sponsorId,sponsorId2].map((sponsorId,i)=>({id:uuid(900+i),kind:'hms-sponsor',org:'EUCHL',scope:'game',targetId:id,sponsorId,enabled:true})),revision:1});
 // Reopen reloads the saved draft library without publishing it.
 await page.reload();await page.locator('#game-title').filter({hasText:'EUCHL Home'}).waitFor();
 await page.locator('[data-phase=game]').click();await page.locator('[data-graphic=leaders-strip]').click();await page.locator('[data-draft=metric]').selectOption('points');
 const revision=rows.get(channelId).revision;await page.waitForTimeout(250);assert.equal(rows.get(channelId).revision,revision);
 const previewBox=await page.locator('#working-preview').boundingBox();assert.ok(previewBox.y+previewBox.height<1000,'Preview should be visible without scrolling');
 const obs=await obsContext.newPage();console.log('Checking preview/program isolation and independent layers');await obs.goto(url);assert.equal(await obs.locator('iframe').count(),0);
 await page.locator('#show-main').click();await obs.waitForFunction(()=>document.querySelector('[data-director-layer=main]')?.contentDocument?.querySelector('[data-layer=leaders-strip]'));
 assert.equal(rows.get(channelId).state.metric,'points');assert.notEqual(await page.locator('[data-graphic=cta]').getAttribute('data-status'),'READY');
 await page.locator('#sponsor-settings').evaluate(el=>el.open=true);await page.locator('[data-sponsor=showSeconds]').fill('1');await page.locator('[data-sponsor=showSeconds]').dispatchEvent('change');
 await page.locator('#show-sponsors').click();await obs.waitForFunction(()=>document.querySelector('[data-director-layer=sponsors]')?.contentDocument?.querySelector('[data-sponsor-id]'));
 await obs.waitForFunction(id=>document.querySelector('[data-director-layer=sponsors]')?.contentDocument?.querySelector('[data-sponsor-id]')?.dataset.sponsorId===id,sponsorId2);await page.locator('#sponsor-settings').evaluate(el=>el.open=false);
 assert.equal(await obs.locator('iframe').count(),2);
 const sponsorHandle=await obs.locator('[data-director-layer=sponsors]').elementHandle(),mainHandle=await obs.locator('[data-director-layer=main]').elementHandle();
 const rotationStart=rows.get(channelId).state.sponsors.sponsorRotation.startedAt;
 await page.locator('[data-draft=metric]').selectOption('goals');assert.equal(rows.get(channelId).state.metric,'points');await page.locator('#show-main').click();
 await obs.waitForFunction(()=>document.querySelector('[data-director-layer=main]')?.contentDocument?.querySelector('.league-metric')?.textContent==='Góly');
 assert.ok(await mainHandle.evaluate(el=>el.isConnected),'Main frame persists across same-game edits');assert.ok(await sponsorHandle.evaluate(el=>el.isConnected),'Sponsor frame persists');assert.equal(rows.get(channelId).state.sponsors.sponsorRotation.startedAt,rotationStart);
 console.log('Checking immediate context preview in every phase');
 releaseInitialContext();await page.waitForFunction(()=>document.querySelector('[data-graphic=next]')?.dataset.status==='READY');
 const contextReads=counts.context;
 for(const phase of ['pre','game','break','post']){
  await page.locator(`[data-phase=${phase}]`).click();
  for(const layer of ['next','results']){await page.locator(`[data-graphic=${layer}]`).click();await page.waitForFunction(layer=>document.querySelector('#working-preview iframe')?.contentDocument?.querySelector(`[data-layer="${layer}"] .fixture-list li`),layer);}
 }
 assert.equal(counts.context,contextReads,'Preview must reuse controller context across phases');
 await page.locator('[data-graphic=scoresheet]').click();await page.locator('#show-main').click();await obs.waitForFunction(()=>document.querySelector('[data-director-layer=main]')?.contentDocument?.querySelectorAll('.goal-list li').length===7);
 assert.ok(await sponsorHandle.evaluate(el=>el.isConnected));assert.equal(await obs.locator('[data-director-layer=sponsors]').evaluate(el=>getComputedStyle(el).visibility),'visible');
 assert.ok(await obs.locator('[data-director-layer=sponsors]').evaluate(el=>Number(el.style.zIndex)>Number(document.querySelector('[data-director-layer=main]').style.zIndex)));
 await page.locator('#sponsor-settings').evaluate(el=>el.open=true);
 await page.locator('[data-sponsor=corner]').selectOption('top-left');assert.equal(rows.get(channelId).state.sponsors.corner,'bottom-right');await page.locator('#show-sponsors').click();await obs.waitForFunction(()=>document.querySelector('[data-director-layer=sponsors]')?.contentDocument?.querySelector('.sponsor-overlay.top-left'));
 await page.locator('[data-sponsor=stacking]').selectOption('auto-hide');await page.locator('#show-sponsors').click();await obs.waitForFunction(()=>getComputedStyle(document.querySelector('[data-director-layer=sponsors]')).visibility==='hidden');
 await page.locator('[data-sponsor=stacking]').selectOption('above');await page.locator('[data-sponsor=corner]').selectOption('bottom-right');await page.locator('#show-sponsors').click();await obs.waitForFunction(()=>getComputedStyle(document.querySelector('[data-director-layer=sponsors]')).visibility==='visible');await page.locator('#sponsor-settings').evaluate(el=>el.open=false);
 const goals=await obs.locator('[data-director-layer=main]').contentFrame().locator('.goal-list li').count();assert.equal(goals,7);
 const order=await obs.locator('[data-director-layer=main]').contentFrame().locator('.goal-list').evaluate(el=>{const rows=[...el.children].map(e=>e.getBoundingClientRect());return rows[0].x===rows[3].x&&rows[0].y<rows[3].y&&rows[4].x>rows[3].x&&rows[4].y<rows[3].y;});assert.ok(order,'Goals read down the left column, then down the right');
 const scoreLayout=await obs.locator('[data-director-layer=main]').contentFrame().locator('.match-layer').evaluate(el=>{const rows=[...el.querySelectorAll('.goal-list li')],footer=el.querySelector('footer').getBoundingClientRect();return rows.every(r=>r.getBoundingClientRect().bottom<footer.top&&r.scrollHeight<=r.clientHeight+1);});assert.ok(scoreLayout,'Seven goals fit without overlap');
 await mkdir('artifacts/broadcast-v2',{recursive:true});await obs.screenshot({path:'artifacts/broadcast-v2/scoring-summary.png',omitBackground:true});
 await page.locator('#hide-main').click();await obs.waitForFunction(()=>!document.querySelector('[data-director-layer=main]'));assert.equal(await obs.locator('[data-director-layer=sponsors]').evaluate(el=>getComputedStyle(el).visibility),'visible');
 await page.locator('[data-phase=pre]').click();await page.locator('[data-graphic=lineup]').click();await page.locator('[data-draft=side]').selectOption('home');await page.locator('#show-main').click();
 await obs.waitForFunction(()=>document.querySelector('[data-director-layer=main]')?.contentDocument?.querySelectorAll('.roster-list li').length===20);
 const lineupFrame=obs.locator('[data-director-layer=main]').contentFrame();assert.equal(await lineupFrame.locator('.page-label').count(),0);
 const fit=await lineupFrame.locator('.match-layer').evaluate(el=>{const last=[...el.querySelectorAll('.roster-list li')].at(-1).getBoundingClientRect(),footer=el.querySelector('footer').getBoundingClientRect();return last.bottom<footer.top;});assert.ok(fit,'20-player roster fits');
 await obs.screenshot({path:'artifacts/broadcast-v2/lineup.png',omitBackground:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'artifacts/broadcast-v2/director.png',fullPage:true});
 console.log('Checking compact overflow layouts');
 const scratch=await obsContext.newPage();await scratch.goto(base+`/broadcast/index.html?org=EUCHL&game=${id}&mode=overlay&layer=lineup&layout=compact`);await scratch.locator('.roster-list').waitFor();
 for(const [layer,side,count,long] of [['lineup','home',24,false],['lineup','both',40,false],['lineup','both',40,true],['scoresheet','both',16,false],['scoresheet','both',20,true]]){
  const result=await scratch.evaluate(async({layer,side,count,long,fixture})=>{
   const {renderMatchLayer}=await import('/broadcast/match-layers.js');const {compactPageSize}=await import('/broadcast/director-model.js');
   const game=fixture;
   if(layer==='lineup')game.match.roster=Array.from({length:count},(_,i)=>({side:side==='both'&&i>=count/2?'away':'home',name:long?'Very long test name '.repeat(7)+i:'Test Player '+i,number:i+1}));
   else game.match.goals=Array.from({length:count},(_,i)=>({side:i%2?'away':'home',clock:'12:34',period:1,scorer:{name:long?'Long test scorer '.repeat(8):'Test Scorer'},assists:[{name:long?'Long test assistant '.repeat(7):'Test Assist A'},{name:long?'Long test assistant '.repeat(7):'Test Assist B'}]}));
   document.querySelector('#app').innerHTML=renderMatchLayer(game,{layer,side,layout:'compact'});
   const panel=document.querySelector('.match-layer'),footer=panel.querySelector('footer').getBoundingClientRect(),rows=[...panel.querySelectorAll(layer==='lineup'?'.roster-list li':'.goal-list li')];
   return {fit:rows.every(r=>r.getBoundingClientRect().bottom<footer.top&&r.getBoundingClientRect().right<=panel.getBoundingClientRect().right),count:rows.length,capacity:compactPageSize(layer,game,side)};
  },{layer,side,count,long,fixture:fixture('EUCHL')});
  assert.ok(result.fit,JSON.stringify({layer,side,count,long,result}));
 }
 await scratch.close();
 console.log('Checking emergency hide, errors and reconnect');hmsFailure=true;await page.locator('#hide-all').click();await obs.waitForFunction(()=>document.querySelectorAll('iframe').length===0);assert.equal(rows.get(channelId).state.visible,false);
 await page.locator('#refresh-data').click();await page.waitForFunction(()=>document.querySelector('#data-status').textContent.includes('unavailable'));await obs.reload();await page.waitForTimeout(2200);assert.equal(await obs.locator('iframe').count(),0);
 hmsFailure=false;zeroGoals=true;await page.locator('#refresh-data').click();await page.locator('[data-phase=game]').click();await page.locator('[data-graphic=scoresheet]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-graphic=scoresheet]').dataset.status==='WAITING FOR DATA');
 zeroGoals=false;await page.locator('#refresh-data').click();await page.waitForTimeout(350);
 await page.locator('#org').selectOption('PHM');await page.locator('[data-game]').filter({hasText:'PHM Home'}).click();await page.locator('#game-title').filter({hasText:'PHM Home'}).waitFor();assert.equal(rows.get(channelId).state.org,'EUCHL');
 await page.locator('[data-phase=pre]').click();await page.locator('[data-graphic=opening]').click();await page.locator('#show-main').click();await page.waitForFunction(()=>!document.querySelector('#show-main').disabled);assert.equal(rows.get(channelId).state.org,'PHM');assert.equal(rows.get(channelId).state.sponsors.visible,false);
 await page.locator('#language').selectOption('en');assert.equal(rows.get(channelId).state.lang,'cs');await page.locator('#show-main').click();await page.waitForFunction(()=>!document.querySelector('#show-main').disabled);assert.equal(rows.get(channelId).state.lang,'en');
 // Race: emergency hide commits before an older show reaches the server.
 let release;delayedShow=new Promise(resolve=>release=resolve);await page.locator('#show-main').click();await page.waitForTimeout(100);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Test storage quota');};});await page.locator('#hide-all').click();await page.waitForTimeout(150);release();await page.waitForTimeout(400);assert.equal(rows.get(channelId).state.visible,false);
 await obs.reload();await page.waitForTimeout(2200);assert.equal(await obs.locator('iframe').count(),0);
 // Export CDN is absent from OBS startup; legacy thumbnail export still loads it on demand.
 const thumbnail=await obsContext.newPage();let exportReads=0;
 await thumbnail.route('https://cdn.jsdelivr.net/**',route=>{exportReads++;return route.fulfill({contentType:'text/javascript',body:'window.html2canvas=async()=>{const c=document.createElement("canvas");c.width=1280;c.height=720;return c;};'});});
 await thumbnail.goto(base+'/broadcast/index.html?mode=thumbnail&org=EUCHL&game='+id);await thumbnail.locator('.thumbnail-stage').waitFor();assert.equal(exportReads,0);
 const [download]=await Promise.all([thumbnail.waitForEvent('download'),thumbnail.locator('#download-thumbnail').click()]);assert.match(download.suggestedFilename(),/\.png$/);assert.equal(exportReads,1);await thumbnail.close();
 for(const size of [{width:1280,height:800},{width:1920,height:1080},{width:390,height:844}]){await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`artifacts/broadcast-v2/control-${size.width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');const panic=await page.locator('#hide-all').boundingBox();assert.ok(panic.y>=0&&panic.y+panic.height<size.height,'Emergency hide always visible');if(size.width>700){const hide=await page.locator('#hide-sponsors').boundingBox();assert.ok(hide.y+hide.height<size.height,'Layer controls visible with preview on desktop');}}
 await page.route('**/api/broadcast?capabilities=1',route=>route.fulfill({json:{sandbox:false}}));await page.reload();await page.waitForFunction(()=>document.querySelector('#test-banner').dataset.environment==='production');
 assert.doesNotMatch(await page.locator('#test-banner').textContent(),/TEST V2|TESTOVACÍ/);assert.equal(await page.locator('#create-channel').textContent(),'Create OBS channel');assert.equal(rows.get(channelId).state.visible,false);
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/broadcast-v2/browser-results.json',JSON.stringify({passed:true,scenarios:12,fixtureOnly:true,counts},null,2));
 console.log(JSON.stringify({passed:true,scenarios:12,counts}));
}finally{releaseInitialContext();await browser?.close();await new Promise(resolve=>server.close(resolve));}
