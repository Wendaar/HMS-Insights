import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {server} from '../src/server.js';
import {createChannelHandler} from '../src/web/broadcast-channel.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const id='6C02DF50-CE27-11F1-A5F0-6320901B5AD5',rows=new Map();
const store={async create(id,hash,state){const row={id,control_hash:hash,state,revision:1};rows.set(id,row);return row;},async get(id){return rows.get(id);},
  async update(id,hash,revision,state){const row=rows.get(id);if(!row||row.control_hash!==hash||row.revision!==revision)return null;const next={...row,state,revision:revision+1};rows.set(id,next);return next;}};
const handler=createChannelHandler({env:{HMS_EUCHL_ORGANIZATION_ID:'11111111-1111-1111-1111-111111111111',HMS_EUCHL_API_TOKEN:'test'},store});
const fixture={schemaVersion:1,org:'EUCHL',gameId:id,date:'2026-10-23',time:'21:15',status:'NOT PLAYED',home:{name:'Prague Guardians'},away:{name:'Bratislava Capitals'},source:'HMS API',readAt:'2026-10-23T13:00:00Z',
  match:{roster:Array.from({length:50},(_,i)=>({id:'p-'+i,name:i<25?'Test Home Player '+i:'Test Away Player '+i,side:i<25?'home':'away',number:i+1,goalie:i===0||i===25})),goals:[],insights:[],periods:[],lineupAvailable:true}};
fixture.home.logoUrl='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/test-home.png';
fixture.away.logoUrl='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/test-away.png';
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;let browser,offline=false;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const controlContext=await browser.newContext({viewport:{width:1067,height:929}}),obsContext=await browser.newContext({viewport:{width:1920,height:1080}});
  const errors=[];
  for(const context of [controlContext,obsContext]){
    context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
    await context.route('https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9d8AAAAASUVORK5CYII=','base64')}));
    await context.route('**/api/broadcast?*',async route=>{
      const req=route.request(),q=Object.fromEntries(new URL(req.url()).searchParams);
      if(q.channel||q.channels){
        if(offline&&req.method()==='GET')return route.fulfill({status:503,json:{error:'offline'}});
        let status=200,headers={};const res={setHeader(k,v){headers[k]=v;},status(c){status=c;return this;},json(body){return route.fulfill({status,headers,json:body});}};
        return handler({method:req.method(),headers:req.headers(),query:q,body:req.postDataJSON()},res);
      }
      return route.fulfill({json:q.gameId?fixture:{org:'EUCHL',items:[],hasMore:false}});
    });
  }
  const control=await controlContext.newPage();await control.goto(root+`/broadcast/index.html?org=EUCHL&game=${id}`);
  await control.locator('#create-channel').click();await control.locator('#channel-url').waitFor();const url=await control.locator('#channel-url').inputValue();
  assert.equal(new URL(url).searchParams.get('game'),null);assert.equal(new URL(url).searchParams.get('mode'),'channel');
  const obs=await obsContext.newPage();await obs.clock.install();await obs.goto(url);await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('.overlay-stage'));
  assert.equal(await obs.evaluate(()=>localStorage.getItem('hms-obs-control-v1')),null);
  assert.equal(await obs.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
  await control.selectOption('#layer','lineup');await control.selectOption('#layer-side','away');await control.selectOption('#language','en');
  await control.getByText('Graphics are visible in OBS.',{exact:true}).waitFor();
  await obs.clock.fastForward(2200);await obs.waitForFunction(()=>document.querySelector('#app>iframe')?.contentDocument?.querySelector('[data-layer="lineup"]'));
  assert.match(await obs.locator('#app>iframe').getAttribute('src'),/lang=en/);
  assert.equal(await obs.evaluate(()=>document.querySelector('#app>iframe').contentDocument.querySelector('h1').textContent),'Lineup');
  assert.match(await obs.evaluate(()=>document.querySelector('#app>iframe').contentDocument.querySelector('.roster-list').textContent),/Test Away Player/);
  for(const size of [{width:1920,height:1080},{width:1280,height:720},{width:1417,height:720},{width:1024,height:768},{width:2560,height:1080}]){
    await obs.setViewportSize(size);
    await obs.waitForFunction(()=>{const el=document.querySelector('#app>iframe'),b=el.getBoundingClientRect();return b.width<=innerWidth+1&&b.height<=innerHeight+1;});
    const layout=await obs.evaluate(()=>{
      const frame=document.querySelector('#app>iframe'),d=frame.contentDocument,rows=[...d.querySelectorAll('.roster-list li')],panel=d.querySelector('.match-layer').getBoundingClientRect(),last=rows.at(-1).getBoundingClientRect(),page=d.querySelector('.page-label').getBoundingClientRect(),footer=d.querySelector('footer').getBoundingClientRect(),box=frame.getBoundingClientRect();
      return {width:frame.contentWindow.innerWidth,height:frame.contentWindow.innerHeight,count:rows.length,clear:last.bottom<=page.top&&page.bottom<footer.top&&footer.bottom<=panel.bottom,
        centered:Math.abs(box.x+box.width/2-innerWidth/2)<1&&Math.abs(box.y+box.height/2-innerHeight/2)<1,panelCentered:Math.abs(panel.x+panel.width/2-960)<1};
    });
    assert.deepEqual(layout,{width:1920,height:1080,count:20,clear:true,centered:true,panelCentered:true},JSON.stringify(size));
  }
  await mkdir('artifacts/broadcast',{recursive:true});await obs.setViewportSize({width:1280,height:720});await obs.screenshot({path:'artifacts/broadcast/lineup-channel-720.png',omitBackground:true});
  // The standalone clean output fits the same complete design canvas too.
  const direct=await obsContext.newPage();await direct.setViewportSize({width:1417,height:720});
  await direct.goto(await obs.locator('#app>iframe').getAttribute('src'));await direct.locator('.roster-list li').last().waitFor();
  const directLayout=await direct.evaluate(()=>{const last=[...document.querySelectorAll('.roster-list li')].at(-1).getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect();return {count:document.querySelectorAll('.roster-list li').length,fit:last.bottom<footer.top&&footer.bottom<=innerHeight};});
  assert.deepEqual(directLayout,{count:20,fit:true});await direct.close();
  assert.equal(await control.locator('#channel-url').inputValue(),url);
  await control.locator('#toggle-channel').click();await control.getByText('Graphics are hidden in OBS.',{exact:true}).waitFor();
  await obs.clock.fastForward(2200);await obs.waitForFunction(()=>!document.querySelector('#app>iframe'));
  await obs.reload();assert.equal(await obs.locator('#app>iframe').count(),0);
  await control.reload();await control.locator('#channel-url').waitFor();assert.equal(await control.locator('#channel-url').inputValue(),url);
  await control.getByText('Graphics are hidden in OBS.',{exact:true}).waitFor();
  await control.locator('#toggle-channel').click();await control.getByText('Graphics are visible in OBS.',{exact:true}).waitFor();
  await obs.clock.fastForward(2200);await obs.waitForFunction(()=>document.querySelector('#app>iframe'));
  const first=await obs.locator('#app>iframe').getAttribute('src');await obs.clock.fastForward(2200);assert.equal(await obs.locator('#app>iframe').getAttribute('src'),first);
  offline=true;await obs.clock.fastForward(14000);await obs.waitForFunction(()=>!document.querySelector('#app>iframe'));
  offline=false;
  const portableContext=await browser.newContext(),portable=await portableContext.newPage();
  await portableContext.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  // Use the same deterministic transport on the new controller browser.
  await portableContext.route('**/api/broadcast?*',async route=>{
    const req=route.request(),q=Object.fromEntries(new URL(req.url()).searchParams);
    if(!q.channel)return route.fulfill({json:q.gameId?fixture:{org:'EUCHL',items:[],hasMore:false}});
    let code=200;return handler({method:req.method(),headers:req.headers(),query:q,body:req.postDataJSON()},{setHeader(){},status(c){code=c;return this;},json(body){return route.fulfill({status:code,json:body});}});
  });
  const binding=await control.evaluate(()=>JSON.parse(localStorage.getItem('hms-obs-control-v1')));
  await portable.goto(control.url()+'#control='+binding.id+'.'+binding.key);
  await portable.locator('#channel-url').waitFor();assert.equal(await portable.locator('#channel-url').inputValue(),url);
  assert.equal(new URL(portable.url()).hash,'');await portable.getByText('Graphics are visible in OBS.',{exact:true}).waitFor();
  await portable.locator('#toggle-channel').click();await portable.getByText('Graphics are hidden in OBS.',{exact:true}).waitFor();
  assert.equal((await store.get(binding.id)).state.visible,false);
  await mkdir('artifacts/broadcast',{recursive:true});await control.screenshot({path:'artifacts/broadcast/channel-control.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('OBS channel browser checks passed: isolated controller/viewer, one permanent URL, remote layer/team/language, hide/show, reload persistence, transparent output and fail-closed disconnect.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
