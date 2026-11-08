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
