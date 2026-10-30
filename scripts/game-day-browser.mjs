// Synthetic fixture UI/export verification; no HMS, DB or email credentials.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {server} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.STUDIO_TEST_OUTPUT||'test-output/game-day';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={gameId:'11111111-1111-1111-1111-111111111111',org:'PHM',date:'2026-10-31',time:'20:15',venue:'Praha',competition:'PHM Cup',eligible:true,home:{id:'h',name:'Hc Slavoj Zbraslav',jerseyColor:'#ffffff',preview:{rank:2,form:[{result:'W'}],offense:4.5,defense:2.5,rating:{score:73},attendance:12,players:[{name:'Adam Patočka',points:8}]}},away:{id:'a',name:'HC Kosti',jerseyColor:'#304bb2',preview:null},links:{game:'/game-center/example',compare:'/team-comparison/phm'}};
 const config={enabled:true,automatic:false,language:'cs',branding:{title:'PHM GAME DAY',accent:'#78e5b8'},schedule:{league:24,tournament:3},competitionTypes:{},recipientTeamIds:[]};
 let queued=0;
 await page.route('**/api/studio?*',r=>r.fulfill({json:new URL(r.request().url()).searchParams.has('catalog')?{organizations:[{code:'PHM',slug:'phm',name:'PHM',configured:true},{code:'EUCHL',slug:'euchl',name:'EUCHL',configured:false}]}:{items:[],source:'browser-test-fixture',from:'2026-10-31',to:'2026-10-31'}}));
 await page.route('**/api/game-day?*',async route=>{const q=new URL(route.request().url()).searchParams,action=q.get('action');
  if(action==='day'){const offset=Number(q.get('offset'));return route.fulfill({json:{items:Array.from({length:offset===0?20:4},(_,i)=>({...fixture,org:q.get('org'),date:q.get('date'),gameId:String(offset+i),venue:offset+i<20?'Praha':'Brno',home:{...fixture.home,name:fixture.home.name+' '+(offset+i)}})),hasMore:offset===0,source:'browser-test-fixture'}});}
  if(action==='preview')return route.fulfill({json:fixture});
  if(!route.request().headers().authorization)return route.fulfill({status:401,json:{error:'Access key required'}});
  if(action==='center')return route.fulfill({json:{config,contacts:[],jobs:[]}});
  if(action==='queue'){queued++;assert.equal(route.request().postDataJSON().mode,'test');}
  return route.fulfill({json:{mode:'test',queued:1}});
 });
 await page.goto(origin+'/studio/phm?section=game-day');await page.locator('#gameDayPanel canvas').waitFor();await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea')?.value.includes('HC Kosti'));
 assert.equal(await page.locator('.workspace').isVisible(),false);
 const panel=page.locator('#gameDayPanel');
 assert.match(await panel.getByRole('status').textContent(),/24/);
 const venue=panel.locator('label').filter({hasText:/^Stadion/}).locator('select');await venue.selectOption('Brno');assert.equal(await panel.locator('.filters').nth(1).getByRole('button').count(),4);await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('Zbraslav 20'));
 await venue.selectOption('');await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('Zbraslav 0'));await panel.getByRole('button',{name:'Další Story →',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('Zbraslav 6'));
 await panel.getByRole('button',{name:'← Předchozí Story',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('Zbraslav 0'));
 const pages=await page.evaluate(async()=>{const {storyPages}=await import('/studio/game-day-graphics.js');const rows=Array.from({length:27},(_,i)=>({gameId:i,venue:i<14?'A':i<20?'B':'C'}));for(const cols of [1,2]){const pages=storyPages(rows,cols);if(pages.flat().length!==rows.length||new Set(pages.flat().map(p=>p.gameId)).size!==rows.length)throw Error('Dropped games');}return true;});assert.equal(pages,true);
 const downloadEvent=page.waitForEvent('download');await panel.getByRole('button',{name:'Stáhnout Stories PNG',exact:true}).click();const download=await downloadEvent;await download.saveAs(out+'/story.png');const png=await readFile(out+'/story.png');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920);
 await panel.getByRole('button',{name:/20:15 · Hc Slavoj Zbraslav 0/}).click();await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('73 / 100'));
 const home=panel.locator('input[placeholder*="Domácí"]');await home.fill('#abcdef');await page.waitForFunction(()=>document.querySelector('#gameDayPanel textarea').value.includes('#abcdef'));
 await panel.locator('summary').filter({hasText:'Reminder Center'}).click();await panel.getByRole('button',{name:'Otevřít centrum'}).click();await panel.getByRole('status').filter({hasText:'Access key required'}).waitFor();
 await panel.locator('input[type=password]').fill('synthetic-test-key');await panel.getByRole('button',{name:'Otevřít centrum'}).click();await panel.getByText('0 kontaktů · TEST MODE',{exact:true}).waitFor();
 const queueResponse=page.waitForResponse(r=>r.url().includes('action=queue'));await panel.getByRole('button',{name:'Připravit připomínku vybraného zápasu'}).click();await queueResponse;assert.equal(queued,1);
 await page.screenshot({path:out+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/mobile.png',fullPage:true});
 await page.locator('#games').click();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('.workspace').isVisible(),true);
 await page.locator('#gameDay').click();assert.equal(await panel.locator('input[type=password]').inputValue(),'');
 await page.evaluate(()=>{window.open=(url)=>{window.__sharedUrl=url;return null;};navigator.canShare=()=>false;});await panel.getByRole('button',{name:'WhatsApp',exact:true}).click();assert.match(await page.evaluate(()=>window.__sharedUrl),/^https:\/\/wa.me\/\?text=/);
 await page.goto(origin+'/studio/phm?section=game-day&lang=en');await page.getByText('Stories and invitations from shared data. Email is test mode only.',{exact:true}).waitFor();assert.equal(await page.locator('#gameDayPanel label').filter({hasText:'Home jersey'}).count(),1);
 assert.deepEqual(errors,[]);console.log('Game Day browser checks passed: PNG 1080x1920, pagination, match stats, jersey override, private center, test queue, mobile, navigation. Synthetic fixtures only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
