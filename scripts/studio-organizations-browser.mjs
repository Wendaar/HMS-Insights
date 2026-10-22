// Synthetic fixtures verify presentation and tenant switching, not live credentials.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.STUDIO_ORGS_OUTPUT||'/tmp/hms-studio-organizations';await mkdir(output,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}:{} )});
const orgs=[{code:'PHM',slug:'phm',name:'PHM',configured:true},{code:'YELLOW',slug:'yellow',name:'Yellow Hockey',configured:true},{code:'FLLLH',slug:'flllh',name:'FLLLH',configured:false}];
const playerId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',homeId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',awayId='cccccccc-cccc-cccc-cccc-cccccccccccc';
const gameId='dddddddd-dddd-dddd-dddd-dddddddddddd';
const insight={id:`${gameId}:HATTRICK:${playerId}`,gameId,playerId,teamId:awayId,player:'Matěj Kuracina',team:'Berkut',type:'HATTRICK',title:'Hattrick',text:'Matěj Kuracina vstřelil 3 góly.',stats:{goals:3},date:'2026-10-22'};
const fixture={gameId,status:'FINISHED',playedOn:'2026-10-22',competition:'Pohár Žluťoučký',group:'Skupina A',phase:'Základní část',home:{id:homeId,name:'Domynos',score:1},away:{id:awayId,name:'Berkut',score:4},players:[{id:playerId,teamId:awayId,name:'Matěj Kuracina',goals:3,points:3}],priklepy:[insight],timeline:{coverage:'matches-result',periodScores:[{period:1,home:1,away:1},{period:2,home:0,away:2},{period:3,home:0,away:1}]},readAt:new Date().toISOString(),source:'browser-test-fixture'};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.addInitScript(()=>{window.canvasTexts=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.canvasTexts.push(text);return original.call(this,text,...args);};});
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/studio?*',async route=>{
  const q=new URL(route.request().url()).searchParams;if(q.has('catalog'))return route.fulfill({json:{organizations:orgs}});
  requests.push(Object.fromEntries(q));const org=q.get('org');if(org==='FLLLH')return route.fulfill({status:503,json:{error:q.get('lang')==='en'?'Data unavailable.':'Data nejsou dostupná.'}});
  const game={...fixture,org,home:{...fixture.home,name:org==='PHM'?'Domynos':'Yellow Lions'}};
  return route.fulfill({json:q.has('gameId')?game:{items:q.get('section')==='insights'?[insight]:[{...game}],source:'HMS',from:'2026-10-22',to:'2026-10-22',hasMore:q.get('offset')==='0'}});
 });
 await page.goto(root+'/studio/Yellow?lang=en');await page.locator('.match').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#org').inputValue(),'YELLOW');assert.match(page.url(),/\/studio\/yellow\?lang=en$/);
 assert.match(await page.locator('h1').innerText(),/Big moments/);assert.equal(await page.locator('#download').innerText(),'↓ Download PNG');assert.equal(await page.locator('#search').getAttribute('placeholder'),'e.g. Kuracina, Berkut…');assert.equal(await page.locator('#filters [data-filter=Today]').innerText(),'Today');
 assert.ok(requests.every(q=>q.org==='YELLOW'&&q.lang==='en'));assert.match(await page.locator('.match').innerText(),/Yellow Lions/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await Promise.all([page.waitForResponse(r=>new URL(r.url()).searchParams.get('offset')==='20'),page.click('#next')]);assert.ok(requests.some(q=>q.org==='YELLOW'&&q.offset==='20'));
 await page.locator('.match').first().click();await page.waitForFunction(()=>!document.getElementById('download').disabled);await page.fill('#partner','ODIN');
 await page.selectOption('#org','PHM');await page.locator('.match').waitFor();assert.equal(await page.locator('#partner').inputValue(),'');assert.match(page.url(),/\/studio\/phm\?lang=en$/);assert.equal(await page.locator('#download').isDisabled(),true);
 await page.selectOption('#org','YELLOW');await page.locator('.match').waitFor();assert.equal(await page.locator('#partner').inputValue(),'ODIN');await page.reload();await page.locator('.match').waitFor();assert.equal(await page.locator('#org').inputValue(),'YELLOW');assert.equal(await page.locator('#partner').inputValue(),'ODIN');
 await page.locator('.match').first().click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
 for(const kind of ['period-1',`moment-${insight.id}`])for(const design of ['clean','crazy','artistic','technical','pantha'])for(const format of ['1:1','9:16']){
  await page.evaluate(()=>window.canvasTexts=[]);await page.selectOption('#template',kind);await page.selectOption('#design',design);await page.selectOption('#format',format);await page.waitForFunction(()=>!document.getElementById('download').disabled);
  const texts=await page.evaluate(()=>window.canvasTexts);assert.ok(texts.includes('PRESENTS'));assert.ok(texts.includes('Pohár Žluťoučký'),'proper competition name remains unchanged');
  if(kind==='period-1'){assert.ok(texts.includes('END OF PERIOD 1'));assert.ok(texts.includes('1'));assert.ok(!texts.includes('PO 1. TŘETINĚ'));}else{assert.ok(texts.includes('GOALS'));assert.ok(texts.includes('3 goals.'));assert.ok(texts.includes('MATĚJ KURACINA'));assert.ok(!texts.includes('Matěj Kuracina vstřelil 3 góly.'));}
  const event=page.waitForEvent('download');await page.click('#download');const download=await event;assert.match(download.suggestedFilename(),/^YELLOW 2026-10-22/);const path=`${output}/${kind==='period-1'?'period':'insight'}-${design}-${format.replace(':','x')}.png`;await download.saveAs(path);const png=await readFile(path);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),format==='9:16'?1920:1080);
 }
 await page.screenshot({path:output+'/english-mobile.png',fullPage:true});await page.selectOption('#language','cs');await page.waitForURL('**/studio/yellow?lang=cs');await page.locator('.match').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'cs');assert.equal(await page.locator('#partner').inputValue(),'ODIN');assert.equal(await page.locator('#download').innerText(),'↓ Stáhnout PNG');assert.equal(await page.locator('#filters [data-filter=Today]').innerText(),'Dnes');
 await page.selectOption('#org','FLLLH');await page.waitForFunction(()=>document.getElementById('list').textContent.includes('Data nejsou dostupná'));assert.equal(await page.locator('#download').isDisabled(),true);assert.match(page.url(),/\/studio\/flllh\?lang=cs$/);
 const before=requests.length;await page.goto(root+'/studio/unknown?lang=en');await page.waitForFunction(()=>document.getElementById('list').textContent.includes('This organization is not available'));assert.equal(requests.length,before,'unknown path performs no default-PHM data request');assert.equal(await page.locator('#download').isDisabled(),true);
 await page.selectOption('#org','PHM');await page.locator('.match').waitFor();assert.match(page.url(),/\/studio\/phm\?lang=en$/);
 await page.goto(root+'/studio/PHM?lang=de');await page.locator('.match').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'cs');assert.match(page.url(),/\/studio\/phm\?lang=cs$/);assert.deepEqual(errors,[]);
 // Verify real local assets and legacy public surfaces, without API interception.
 for(const path of ['/studio/yellow','/studio/i18n.js','/studio/routing.js','/priklepy','/game-center/F6321894-98CA-11F1-8BDF-EF2495D048F3']){const response=await context.request.get(root+path);assert.equal(response.status(),200,path);}
 console.log('Organizations/languages browser passed: direct/reloaded/mixed-case routes, unknown route fail-closed, EN/CS switch, localized canvas text, 20 PNGs (five designs × two ratios × period/Insight), scoped settings and pagination, 390px mobile, report/feed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
