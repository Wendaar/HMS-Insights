import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,runPilot} from './pilot.mjs';
const cli=fileURLToPath(new URL('./pilot.mjs',import.meta.url));
const env={...process.env,HMS_API_TOKEN:'',FLICKR_API_KEY:'',OPENAI_API_KEY:'',PHOTO_VISION_MODEL:''};
const invoke=args=>spawnSync(process.execPath,[cli,...args],{env,encoding:'utf8',timeout:10000});
async function temporary(fn) {
  const dir=await mkdtemp(join(tmpdir(),'hms-photo-test-'));
  try {await fn(dir);} finally {await rm(dir,{recursive:true,force:true});}
}
async function reportAt(dir) {
  const [run]=await readdir(dir);return JSON.parse(await readFile(join(dir,run,'summary.json'),'utf8'));
}
test('real CLI help and invalid flags have deterministic exit codes',()=>{
  const help=invoke(['--help']);assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/Usage:/);
  for(const args of [['--limit'],['--limit','NaN'],['--limit','1.5'],['--limit','501'],['--case','0'],['--no-such-flag'],['toString'],['--resolve-only','--analyze'],['--vision-limit','2'],['--limit','2','--limit','3']]) {
    const r=invoke(args);assert.equal(r.status,2,JSON.stringify({args,stderr:r.stderr}));assert.equal(r.stdout,'');
  }
});
test('real offline CLI writes four independent failures and exits 1 without credentials',async()=>temporary(async dir=>{
  const r=invoke(['--offline','--analyze','--limit','2','--out',dir]);
  assert.equal(r.status,1,r.stderr);
  const report=await reportAt(dir);assert.equal(report.mode,'offline');assert.equal(report.summary.length,4);assert.equal(report.visionCalls,0);
  for(const row of report.summary) {
    assert.match(row.hms.error,/HMS_API_TOKEN/);assert.match(row.flickr.error,/FLICKR_API_KEY/);assert.match(row.vision.error,/OPENAI_API_KEY/);
  }
}));
test('offline mode cannot call network even when all keys are supplied',async()=>temporary(async dir=>{
  const code=await runPilot(parseArgs(['--offline','--analyze','--case','2','--out',dir]),{
    env:{HMS_API_TOKEN:'x',FLICKR_API_KEY:'y',OPENAI_API_KEY:'z',PHOTO_VISION_MODEL:'fixture'},log:()=>{},
    fetchImpl:()=>assert.fail('Network forbidden in offline mode')
  });
  assert.equal(code,1);assert.equal((await reportAt(dir)).summary.length,1);
}));
test('complete mocked pipeline records observations, keeps ambiguity and enforces global image budget',async()=>temporary(async dir=>{
  let imageCalls=0;
  const code=await runPilot(parseArgs(['--analyze','--limit','2','--vision-limit','1','--out',dir]),{
    env:{HMS_API_TOKEN:'fake-hms',FLICKR_API_KEY:'fake-flickr',OPENAI_API_KEY:'fake-openai',PHOTO_VISION_MODEL:'fixture'},log:()=>{},
    fetchImpl:async(value,init)=>{
      const url=new URL(value);
      if(url.hostname==='flic.kr') return new Response(null,{status:302,headers:{location:'https://www.flickr.com/photos/owner/sets/72177720336372497/'}});
      if(url.hostname==='public-api.prod.hms.wootera.net') {
        assert.equal(init.method || 'GET','GET');
        const gameId=url.searchParams.get('gameId');
        return Response.json(url.pathname.endsWith('/game')?{gameId,homeTeamId:'home',awayTeamId:'away'}:
          {gameId,Lineups:[{playerId:'a',teamId:'home',number:88},{playerId:'b',teamId:'away',number:88}]});
      }
      if(url.hostname==='www.flickr.com') return Response.json({stat:'ok',photoset:{id:'72177720336372497',total:2,photo:[{id:'p1',url_b:'https://live.staticflickr.com/1/x_b.jpg'},{id:'p2',url_b:'https://live.staticflickr.com/1/y_b.jpg'}]}});
      assert.equal(url.href,'https://api.openai.com/v1/responses');imageCalls++;
      return Response.json({status:'completed',model:'fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({observations:[{jerseyNumber:'88',confidence:0.99,evidence:'Visible back number',jerseyDescription:'Blue'}]})}]}]});
    }
  });
  assert.equal(imageCalls,1);assert.equal(code,1); // Remaining cases accurately report the exhausted budget.
  const report=await reportAt(dir);assert.equal(report.visionCalls,1);assert.equal(report.summary[0].vision.analyzed,1);
  assert.match(report.summary[1].vision.error,/limit reached/);
  const [run]=await readdir(dir);
  const [photo]=JSON.parse(await readFile(join(dir,run,'case-1-analysis.json'),'utf8'));
  assert.equal(photo.suggestions[0].reason,'ambiguous_number');assert.equal(photo.suggestions[0].candidates.length,2);
  assert.equal(photo.suggestions[0].status,'review');
}));
test('resolve-only success skips HMS, Flickr API and vision entirely',async()=>temporary(async dir=>{
  let calls=0;
  const code=await runPilot(parseArgs(['--resolve-only','--case','1','--out',dir]),{env:{},log:()=>{},fetchImpl:async()=>{
    calls++;return new Response(null,{status:302,headers:{location:'https://www.flickr.com/photos/owner/albums/72177720336372497/'}});
  }});
  assert.equal(code,0);assert.equal(calls,1);const report=await reportAt(dir);
  assert.equal(report.mode,'resolve-only');assert.equal(report.summary[0].hms,undefined);
}));
