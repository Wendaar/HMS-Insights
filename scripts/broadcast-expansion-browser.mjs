import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
import {createChannelHandler} from '../src/web/broadcast-channel.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,rows=new Map(),libraries=new Map();
const store={async create(id,hash,state){const row={id,hash,state,revision:1};rows.set(id,row);return row;},async get(id){const r=rows.get(id);return r?{...r,library_revision:libraries.get(id)?.revision??0}:null;},async update(id,hash,revision,state){const r=rows.get(id);if(!r||r.hash!==hash||r.revision!==revision)return null;const next={...r,state,revision:revision+1};rows.set(id,next);return next;},async library(id){return libraries.get(id)??{items:[],revision:0};},async saveLibrary(id,hash,revision,items){const r=rows.get(id),lib=await this.library(id);if(r?.hash!==hash||lib.revision!==revision)return null;const saved={items,revision:revision+1};libraries.set(id,saved);return saved;}};
const handler=createChannelHandler({env:{HMS_EUCHL_ORGANIZATION_ID:uid(2),HMS_EUCHL_API_TOKEN:'test'},store});
const fixture={schemaVersion:1,org:'EUCHL',gameId:uid(1),date:'2026-10-24',time:'19:00',home:{id:uid(3),name:'North Wolves'},away:{id:uid(4),name:'South Falcons'},status:'FINISHED',competition:'DEMO League',match:{roster:[],goals:[],insights:[],periods:[],coverage:'matches-score',score:{home:0,away:0}},context:{historyAvailable:true,scope:{competition:'DEMO League',season:'2026/27'},teams:{home:{games:2,wins:2,draws:0,losses:0,players:[],results:[],specialTeams:{available:false,covered:0,total:2}},away:{games:2,players:[],specialTeams:{available:false,covered:0,total:2}}},nextAvailable:true,next:{home:[],away:[]}}};
const sponsorFixture={org:'EUCHL',items:[{id:uid(20),name:'Team partner A',claim:'Claim A',web:'https://example.com',scopeRefs:{teamIds:[uid(3)]}},{id:uid(21),name:'Team partner B',claim:'Claim B',web:'https://example.org',scopeRefs:{teamIds:[uid(3)]}},{id:uid(22),name:'Away-only partner',scopeRefs:{teamIds:[uid(4)]}}],bindings:[]};
sponsorFixture.teams=[{id:uid(3),name:'North Wolves'},{id:uid(4),name:'South Falcons'}];sponsorFixture.teamsAvailable=true;sponsorFixture.readAt=new Date().toISOString();
fixture.league={scope:{competition:'DEMO League',season:'2026/27',group:'Division A'},standingsAvailable:true,leadersAvailable:true,statsScope:'group',standings:Array.from({length:16},(_,i)=>({id:i===2?uid(3):i===11?uid(4):uid(100+i),name:i===2?'North Wolves':i===11?'South Falcons':`Team ${i+1}`,rank:i+1,games:8,points:30-i})),leaders:{home:[{id:uid(50),name:'Home Leader',games:8,points:20,goals:12,assists:8}],away:[{id:uid(51),name:'Away Leader',games:8,points:15,goals:5,assists:10}]}};
await mkdir('artifacts/broadcast',{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const controlContext=await browser.newContext({viewport:{width:1440,height:1080}}),obsContext=await browser.newContext({viewport:{width:1920,height:1080}}),errors=[];
  for(const context of [controlContext,obsContext]){
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
    await context.route('**/api/broadcast?*',async route=>{
      const r=route.request(),q=Object.fromEntries(new URL(r.url()).searchParams);
      if(q.channel||q.channels)return handler({method:r.method(),query:q,headers:r.headers(),body:r.postDataJSON()},{setHeader(){},status(code){this.code=code;return this;},json(body){return route.fulfill({status:this.code??200,json:body});}});
      if(q.capabilities)return route.fulfill({json:{sandbox:true}});
      if(q.catalog)return route.fulfill({json:sponsorFixture});
      return route.fulfill({json:q.gameId?fixture:{org:'EUCHL',items:[],hasMore:false}});
    });
  }
  const control=await controlContext.newPage();await control.goto(base+`/broadcast/index.html?org=EUCHL&game=${uid(1)}`);await control.locator('#create-channel').click();await control.locator('#channel-url').waitFor();assert.match(await control.locator('.preview-notice').textContent(),/TESTOVACÍ/);
  const obsUrl=await control.locator('#channel-url').inputValue(),obs=await obsContext.newPage();await obs.goto(obsUrl);await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('.overlay-stage'));
  const png=await control.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,200,200);x.fillStyle='black';x.fillText('TEST IMAGE',20,100);return c.toDataURL('image/png').split(',')[1];});
  async function addItem(title,kind='cta'){
    await control.locator('.library-panel summary').click();await control.locator('.library-form').waitFor();
    await control.selectOption('.library-form [name=kind]',kind);await control.fill('.library-form [name=title]',title);await control.fill('.library-form [name=claim]','Test claim');await control.fill('.library-form [name=url]','https://example.com');
    await control.locator('.library-form [name=image]').setInputFiles({name:'asset.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await control.locator('.library-form button').click();await control.waitForFunction(()=>!document.querySelector('.library-panel').open);
  }
  await addItem('CTA Test');await addItem('Sponsor A','sponsor');await addItem('Sponsor B','sponsor');
  await control.selectOption('#layer','cta');await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer=cta] .qr-image'));assert.match(await obs.evaluate(()=>document.querySelector('#app>iframe')?.contentDocument?.body?.textContent),/CTA Test/);
  await control.selectOption('#layer','sponsors');await control.selectOption('#partner-source','library');await control.selectOption('#layer-rotation','5');await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer=sponsors]'));
  const frame=obs.frames().find(f=>f.url().includes('mode=overlay'));await frame.getByText('Sponsor A',{exact:true}).waitFor();await frame.getByText('Sponsor B',{exact:true}).waitFor({timeout:8000});
  await control.selectOption('#layer','powerplay');await control.selectOption('#layer-side','away');await control.selectOption('#layer-corner','top-right');await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer=powerplay].top-right'));
  await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.body?.textContent.includes('Spolehlivý výpočet'));
  assert.equal(new URL(await obs.locator('#app>iframe').getAttribute('src')).searchParams.get('side'),'away');assert.equal(await control.locator('#channel-url').inputValue(),obsUrl);
  await control.locator('#toggle-channel').click();await obs.waitForFunction(()=>!document.querySelector('#app>iframe'));await control.reload();await control.getByText('V OBS je grafika skrytá.',{exact:true}).waitFor();
  await control.locator('.library-panel summary').click();await control.getByText('CTA Test',{exact:true}).waitFor();assert.equal(await control.locator('.library-list li').count(),3);
  await control.selectOption('#layer','sponsors');await control.selectOption('#partner-source','hms');await control.selectOption('#partner-scope','team');await control.selectOption('#layer-side','home');await control.locator('.partner-choices li').first().waitFor();assert.equal(await control.locator('.partner-choices li').count(),2);
  await control.locator('[data-down="0"]').click();await Promise.all([control.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('library=1')),control.locator('#save-partners').click()]);await control.locator('#save-partners').waitFor();
  const library=[...libraries.values()][0];assert.deepEqual(library.items.filter(a=>a.kind==='hms-sponsor').map(a=>a.sponsorId),[uid(21),uid(20)]);assert.equal(await obs.locator('#app>iframe').count(),0,'Editing playlist must preserve hidden state');
  await control.locator('#partner-slot').getByText('Claim B',{exact:true}).waitFor();
  await control.locator('#partner-slot').screenshot({path:'artifacts/broadcast/central-partner-selection.png'});
  await control.locator('#toggle-channel').click();await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.body?.textContent.includes('Team partner B'));
  await control.selectOption('#layer','announcement');await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer=announcement]'));assert.equal(await control.locator('#channel-url').inputValue(),obsUrl);
  const announce=obs.frames().find(f=>f.url().includes('mode=overlay'));assert.equal(await announce.locator('[data-layer=announcement]').evaluate(el=>el.scrollHeight<=el.clientHeight),true);
  await control.selectOption('#layer-side','away');await control.locator('.partner-choices li').first().waitFor();assert.equal(await control.locator('.partner-choices li').count(),1);assert.match(await control.locator('.partner-choices').textContent(),/Away-only partner/);
  await control.selectOption('#partner-scope','organization');await control.locator('.partner-choices li').first().waitFor();assert.equal(await control.locator('.partner-choices li').count(),3);assert.equal(await control.locator('#layer-side').count(),0);
  await control.locator('[data-index="0"]').uncheck();await control.locator('[data-index="1"]').uncheck();
  await Promise.all([control.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('library=1')),control.locator('#save-partners').click()]);await control.locator('#save-partners').waitFor();
  await control.selectOption('#layer-asset',uid(22));await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.body?.textContent.includes('Away-only partner'));
  assert.equal(new URL(await obs.locator('#app>iframe').getAttribute('src')).searchParams.get('partnerScope'),'organization');
  await control.locator('#partner-slot').screenshot({path:'artifacts/broadcast/organization-partners.png'});
  await control.reload();await control.locator('#partner-source').waitFor();assert.equal(await control.locator('#partner-source').inputValue(),'hms');assert.equal(await control.locator('#layer').inputValue(),'announcement');
  await control.selectOption('#layer','leaders-strip');await control.selectOption('#layer-side','away');await control.selectOption('#layer-metric','assists');
  await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer=leaders-strip]')?.textContent.includes('Away Leader'));
  assert.equal(new URL(await obs.locator('#app>iframe').getAttribute('src')).searchParams.get('metric'),'assists');
  await control.selectOption('#layer','standings');
  await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelectorAll('[data-rank]').length===2);
  assert.deepEqual(await obs.evaluate(()=>[...document.querySelector('#app>iframe').contentDocument.querySelectorAll('[data-rank]')].map(e=>Number(e.dataset.rank))),[3,12]);
  await control.selectOption('#standings-view','full');
  await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelectorAll('[data-rank]').length===8);
  assert.equal(await control.locator('#channel-url').inputValue(),obsUrl,'New layers must retain permanent OBS URL');
  const catalogPage=await controlContext.newPage();await catalogPage.goto(base+'/broadcast/sponsors.html?org=EUCHL');await catalogPage.locator('#catalog-body tr').first().waitFor();
  assert.equal(new URL(catalogPage.url()).pathname,'/sponsors');assert.equal(new URL(catalogPage.url()).searchParams.get('org'),'EUCHL');assert.equal(await catalogPage.locator('#catalog-body tr').count(),3);
  assert.equal(await catalogPage.locator('#studio-link').getAttribute('href'),'/broadcast/?org=EUCHL');assert.equal(await catalogPage.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily.includes('Barlow')),true);
  const gallery=await controlContext.newPage();await gallery.goto(base+'/broadcast/demo.html');await gallery.locator('[data-layer=scoresheet]').waitFor();await gallery.evaluate(()=>document.fonts.ready);
  await gallery.selectOption('#demo-side','both');assert.equal(await gallery.locator('.goal-list li').count(),8);
  assert.equal(await gallery.locator('.goal-list li').last().evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.page-label').getBoundingClientRect().top),true,'Eight goals must fit above pagination');
  await gallery.screenshot({path:'artifacts/broadcast/expansion-eight-goals.png'});await gallery.selectOption('#demo-side','home');
  for(const layer of ['scoresheet','insights','lineup','cta','sponsors','announcement','powerplay','leaders','leaders-strip','standings','next','results'])for(const lang of ['cs','en']){
    await gallery.selectOption('#demo-layer',layer);await gallery.selectOption('#demo-lang',lang);await gallery.locator('[data-layer]').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
    assert.equal(await gallery.locator('[data-layer]').evaluate(el=>el.scrollHeight<=el.clientHeight),true,`${layer}/${lang} overflow`);
    assert.equal(await gallery.locator('[data-layer]').evaluate(el=>{const box=el.getBoundingClientRect();return [...el.querySelectorAll('li,footer,.extra-team,.asset-card')].every(child=>{const r=child.getBoundingClientRect();return r.top>=box.top-1&&r.bottom<=box.bottom+1&&r.left>=box.left-1&&r.right<=box.right+1;});}),true,`${layer}/${lang} children`);
    if(lang==='cs')await gallery.screenshot({path:`artifacts/broadcast/expansion-${layer}.png`});
  }
  await gallery.selectOption('#demo-layer','standings');await gallery.selectOption('#demo-standingsView','opponents');
  assert.deepEqual(await gallery.locator('[data-rank]').evaluateAll(es=>es.map(e=>Number(e.dataset.rank))),[3,12]);assert.equal(await gallery.locator('.standing-gap').count(),1);
  await gallery.selectOption('#demo-standingsView','full');assert.equal(await gallery.locator('[data-rank]').count(),8);assert.equal(await gallery.locator('[data-layer]').evaluate(el=>el.scrollHeight<=el.clientHeight),true);await gallery.screenshot({path:'artifacts/broadcast/expansion-full-standings.png'});
  for(const corner of ['top-left','top-right','bottom-left','bottom-right']){await gallery.selectOption('#demo-layer','powerplay');await gallery.selectOption('#demo-corner',corner);assert.equal(await gallery.locator('[data-layer]').evaluate(el=>{const r=el.getBoundingClientRect(),p=document.querySelector('.demo-preview').getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom;}),true);}
  await gallery.setViewportSize({width:390,height:844});assert.equal(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('Expansion browser checks passed: real image upload, durable protected library, permanent OBS channel, rotation, PP opponent identity, hide/reload persistence, CZ/EN gallery, safe bounds and mobile.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
