import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server as app} from '../src/server.js';
import {createServer} from 'node:http';
import {createStudioHandler} from '../src/web/studio-handler.js';
const fixtureOrg='BB669217-41EB-4162-8040-A73F49A43570',fixtureSeason='E6134160-47CF-11F1-A223-BFDFBDD3A64B',fixtureGame='f6321894-98ca-11f1-8bdf-ef2495d048f3';
const contextHandler=createStudioHandler({env:{HMS_EUCHL_ORGANIZATION_ID:fixtureSeason},
 loadLeagues:async org=>[{organization_id:org,season_id:fixtureSeason,competition_name:org===fixtureOrg?'Test PHM':'Test EUCHL',season_name:'2026/27'}],
 loadControlGames:async (org,season)=>[{organization_id:org,season_id:season,game_id:fixtureGame,played_on:'2026-10-24',home_team_name:'Test A',away_team_name:'Test B'}]});
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/studio'&&['leagues','games'].includes(url.searchParams.get('catalog'))){req.query=Object.fromEntries(url.searchParams);return contextHandler(req,{setHeader:(k,v)=>res.setHeader(k,v),status(n){res.statusCode=n;return this;},json(data){res.setHeader('content-type','application/json');res.end(JSON.stringify(data));}});}
 app.emit('request',req,res);
});
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
 await page.getByRole('button',{name:'Vybrat sezonu a zápas'}).click();
 const id='f6321894-98ca-11f1-8bdf-ef2495d048f3';
 await page.locator('#context-league option').nth(1).waitFor({state:'attached'});await page.selectOption('#context-league',{label:'Test PHM · 2026/27'});await page.locator('#context-game option').nth(1).waitFor({state:'attached'});await page.selectOption('#context-game',{label:'Test A — Test B · 2026-10-24'});
 await page.getByRole('button',{name:'Použít výběr',exact:true}).click();
 assert.equal(await page.locator('[data-node="game-report"] a').getAttribute('href'),'/game-center/'+id);assert.equal(await page.locator('[data-node="game-report"] a').getAttribute('target'),'_blank');assert.equal(await page.locator('#context-dialog input').count(),0);
 await page.selectOption('#organization','euchl');assert.equal(await page.locator('#game').inputValue(),'');
 await page.selectOption('#organization','phm');assert.equal(await page.locator('#game').inputValue(),id);
 await page.reload();assert.equal(await page.locator('#league').inputValue(),'Test PHM · 2026/27');
 await page.getByRole('button',{name:'Game Show Control',exact:true}).click();
 assert.match(await page.locator('#detail-phase').innerText(),/Planned/);assert.equal(await page.locator('#detail-links a').count(),0);
 await page.locator('#detail-dialog [data-close]').click();
 await page.click('#view-list');assert.equal(await page.locator('.list-card').count(),31);
 await page.fill('#search','porovnani tymu');assert.equal(await page.locator('.list-card').count(),1);
 await page.fill('#search','');await page.click('#view-map');
 await page.selectOption('#organization','yhg');assert.equal(await page.locator('.node a').count(),0);
 await page.selectOption('#organization','phm');
 await page.getByRole('button',{name:'Vybrat sezonu a zápas'}).click();await page.click('#clear-context');
 await page.screenshot({path:output+'/desktop-map.png',fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:output+`/mobile-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('Control map browser checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
