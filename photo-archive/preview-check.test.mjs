import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreviewCheck} from './preview-check.mjs';
test('live build check refuses production before reading credentials or making requests',async()=>{
  await assert.rejects(runPreviewCheck({env:{VERCEL_ENV:'production'},fetchImpl:()=>assert.fail('Unexpected network')}),/requires Vercel Preview/);
});
test('branch Secret typo alias is used only in memory; logs redact secrets and preserve independent failures',async()=>{
  const logs=[];
  const env={VERCEL_ENV:'preview',FLICKT_API_KEY:'fixture-flickr-secret'};
  let calls=0;
  const results=await runPreviewCheck({env,log:line=>logs.push(line),fetchImpl:async()=>{
    calls++;throw Error('Transport failed with '+env.FLICKT_API_KEY);
  }});
  assert.equal(calls,4);assert.equal(results.length,4);assert.equal(env.FLICKR_API_KEY,undefined);
  assert.match(logs[0],/"legacyKeyAliasUsed":true/);
  assert.ok(logs.every(line=>!line.includes(env.FLICKT_API_KEY)));
  assert.ok(results.every(r=>r.hms.ok===false && r.flickr.ok===false && r.flickr.error.includes('[redacted]')));
});

const configured={VERCEL_ENV:'preview',HMS_API_TOKEN:'fixture-hms',FLICKT_API_KEY:'fixture-flickr',OPENAI_API_KEY:'fixture-openai',PHOTO_VISION_MODEL:'fixture-model'};
function pipelineFetch(visionResponse,onVision=()=>{}) {
  return async(value,init)=>{
    const url=new URL(value);
    if(url.hostname==='public-api.prod.hms.wootera.net') {
      assert.equal(init.method || 'GET','GET');
      const gameId=url.searchParams.get('gameId');
      return Response.json(url.pathname.endsWith('/game')?{gameId,homeTeamId:'home',awayTeamId:'away'}:
        {gameId,Lineups:[{playerId:'a',teamId:'home',number:88},{playerId:'b',teamId:'away',number:88}]});
    }
    if(url.hostname==='flic.kr') return new Response(null,{status:302,headers:{location:'https://www.flickr.com/photos/owner/albums/72177720336372497/'}});
    if(url.hostname==='www.flickr.com') return Response.json({stat:'ok',photoset:{id:'72177720336372497',total:1,photo:[{id:'fixture-photo',url_b:'https://live.staticflickr.com/1/x.jpg'}]}});
    if(url.hostname==='live.staticflickr.com') {assert.equal(init.method,'HEAD');return new Response(null,{headers:{'content-type':'image/jpeg'}});}
    assert.equal(url.href,'https://api.openai.com/v1/responses');onVision();return visionResponse();
  };
}
test('opt-in vision check analyzes at most three images and emits no roster identities or secrets',async()=>{
  let calls=0;const logs=[];
  const results=await runPreviewCheck({env:configured,analyze:true,log:line=>logs.push(line),fetchImpl:pipelineFetch(()=>Response.json({
    status:'completed',model:'fixture-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({observations:[{jerseyNumber:'88',confidence:0.99,evidence:'Visible back number',jerseyDescription:'Blue'}]})}]}]
  }),()=>calls++)});
  assert.equal(calls,3);assert.ok(results.slice(0,3).every(r=>r.vision.ok));
  assert.equal(results[0].vision.observations[0].candidateCount,2);assert.equal(results[0].vision.observations[0].status,'review');
  assert.match(results[3].vision.error,/budget reached/);assert.equal(results[3].vision.attempted,false);
  assert.ok(logs.every(line=>!line.includes('playerId') && !Object.values(configured).filter(v=>v.startsWith('fixture-')).some(v=>v!=='fixture-model' && line.includes(v))));
});
test('quota rejection stops further paid attempts while all ingestion cases continue',async()=>{
  let calls=0;
  const results=await runPreviewCheck({env:configured,analyze:true,log:()=>{},fetchImpl:pipelineFetch(()=>Response.json({error:{code:'insufficient_quota',message:'private provider details'}},{status:429}),()=>calls++)});
  assert.equal(calls,1);assert.match(results[0].vision.error,/insufficient_quota/);
  assert.ok(results.every(r=>r.hms.ok && r.flickr.ok));assert.equal(results[1].vision.attempted,false);
  assert.ok(JSON.stringify(results).includes('private provider details')===false);
});

test('an unexpected configured model cannot spend credits in a model-pinned test',async()=>{
  let calls=0;
  const results=await runPreviewCheck({env:configured,analyze:true,expectedModel:'gpt-6-luna',log:()=>{},fetchImpl:pipelineFetch(()=>assert.fail('No image calls allowed'),()=>calls++)});
  assert.equal(calls,0);assert.ok(results.every(r=>r.vision.attempted===false && /differs/.test(r.vision.error)));
});
