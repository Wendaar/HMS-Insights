// Synthetic integration check: subject identity, preview auth and Insights UX.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/hms-insights-browser';await mkdir(output,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}:{} )});
const base='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/';
const gameId='f6293ef1-98ca-11f1-8bdf-ef2495d048f3',playerId='da0ba510-648c-11ef-8a7f-3b932af99033',homeId='8c035c24-5703-4628-9f71-e0b6280196db',awayId='baed154a-5e0f-4c57-bd3e-9a4d02fe7072';
const insight={id:`${gameId}:HATTRICK:${playerId}`,gameId,type:'HATTRICK',playerId,teamId:awayId,player:'Matěj Kuracina',team:'Berkut Praha',title:'Hattrick',text:'Matěj Kuracina vstřelil 3 góly.',date:'2026-10-20',homeTeam:'Domynos',awayTeam:'Berkut',homeScore:1,awayScore:4,group:'SUPER',playerImageUrl:base+'Player_TEST',teamLogoUrl:base+'Team_AWAY'};
const second={...insight,id:`${gameId}:HATTRICK:${homeId}`,playerId:homeId,player:'Pavel Test',text:'Pavel Test vstřelil 3 góly.'};
const fixture={gameId,org:'PHM',status:'FINISHED',playedOn:'2026-10-20',competition:'PHM Cup',group:'SUPER',phase:'Základní část',competitionLogoUrl:base+'Competition',groupLogoUrl:base+'Group',home:{id:homeId,name:'Domynos',score:1,logoUrl:base+'Team_HOME'},away:{id:awayId,name:'Berkut',score:4,logoUrl:base+'Team_AWAY'},players:[{id:playerId,teamId:awayId,name:'Matěj Kuracina',imageUrl:base+'Player_TEST',goals:3,assists:0,points:3},{id:homeId,teamId:awayId,name:'Pavel Test',imageUrl:base+'Player_OTHER',goals:3,assists:0,points:3}],timeline:{coverage:'unknown'},readAt:new Date().toISOString(),source:'browser-test-fixture'};
try {
 const ctx=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});await ctx.addCookies([{name:'preview-test',value:'allowed',url:root,httpOnly:true,sameSite:'Lax'}]);
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const colors=await page.evaluate(()=>Object.fromEntries(['red','blue','lime','yellow'].map(color=>{const c=document.createElement('canvas');c.width=80;c.height=80;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,80,80);return [color,c.toDataURL('image/png')];})));
 const requests=[];let protectedImageReads=0;
 await page.route('**/api/studio-image?*',async route=>{
   if(!((await route.request().allHeaders()).cookie||'').includes('preview-test=allowed'))return route.fulfill({contentType:'text/html',body:'sign in'});
   protectedImageReads++;const url=new URL(route.request().url()).searchParams.get('url');const color=url.includes('Player')?'lime':url.includes('HOME')?'red':url.includes('AWAY')?'blue':'yellow';
   await route.fulfill({contentType:'image/png',body:Buffer.from(colors[color].split(',')[1],'base64')});
 });
 await page.route('**/api/studio?*',async route=>{const q=new URL(route.request().url()).searchParams;requests.push(Object.fromEntries(q));await route.fulfill({json:q.has('gameId')?fixture:{items:q.get('section')==='insights'?[insight,second].filter(i=>!q.get('query')||i.player.includes(q.get('query'))):[{...fixture,playedOn:fixture.playedOn}],hasMore:false,offset:0,source:'browser-test-fixture'}});});
 await page.goto(root+'/studio');await page.click('#insights');assert.equal(await page.locator('#filters').isVisible(),false);assert.equal(await page.locator('#search').isVisible(),true);
 await page.fill('#search','Kuracina');await page.waitForResponse(r=>r.url().includes('query=Kuracina'));assert.ok(requests.some(q=>q.section==='insights'&&q.query==='Kuracina'));assert.match(await page.locator('.match').innerText(),/Berkut/);assert.match(await page.locator('.match').innerText(),/1:4/);
 await page.click('.match');await page.waitForFunction(()=>!document.getElementById('download').disabled);assert.match(await page.locator('#subjectInfo').innerText(),/Matěj Kuracina · Berkut/);
 const pixels=await page.evaluate(()=>{const c=document.getElementById('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0,blue=0,red=0;for(let i=0;i<d.length;i+=4){if(d[i]===0&&d[i+1]===255&&d[i+2]===0)green++;if(d[i]===0&&d[i+1]===0&&d[i+2]===255)blue++;if(d[i]===255&&d[i+1]===0&&d[i+2]===0)red++;}return {green,blue,red};});
 assert.ok(pixels.green>10000,'portrait pixels');assert.ok(pixels.blue>1000,'away crest');assert.equal(pixels.red,0,'no home crest');assert.ok(protectedImageReads>=3);assert.equal(await page.locator('#safeGuide').isVisible(),true);
 await page.fill('#partnerLogo','http://localhost/reject');assert.equal(await page.locator('#download').isDisabled(),true);await page.fill('#partnerLogo','');await page.waitForFunction(()=>!document.getElementById('download').disabled);
 for(const design of ['clean','crazy'])for(const format of ['1:1','9:16']){await page.selectOption('#design',design);await page.selectOption('#format',format);await page.waitForFunction(()=>!document.getElementById('download').disabled);const event=page.waitForEvent('download');await page.click('#download');const d=await event;const file=`${output}/${design}-${format.replace(':','x')}.png`;await d.saveAs(file);const png=await readFile(file);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),format==='1:1'?1080:1920);}
 await writeFile(output+'/manual-photo.png',Buffer.from(colors.red.split(',')[1],'base64'));await page.setInputFiles('#playerUpload',output+'/manual-photo.png');await page.waitForFunction(()=>!document.getElementById('download').disabled);
 await page.fill('#search','');await page.waitForResponse(r=>r.url().includes('section=insights')&&new URL(r.url()).searchParams.get('query')==='');await page.locator('.match').filter({hasText:'Pavel Test'}).click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
 const redAfterSwitch=await page.evaluate(()=>{const c=document.getElementById('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]===255&&d[i+1]===0&&d[i+2]===0)n++;return n;});assert.equal(redAfterSwitch,0,'manual portrait is scoped to the selected player/game');
 await page.locator('.match').filter({hasText:'Matěj Kuracina'}).click();await page.waitForFunction(()=>!document.getElementById('download').disabled);await page.click('#clearPlayer');await page.waitForFunction(()=>!document.getElementById('download').disabled);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:output+'/mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Insights browser passed: away-player portrait/team identity, search/context, authenticated same-origin images, safe guide, Clean/Crazy × both ratios, portrait upload/reset, 390px.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
