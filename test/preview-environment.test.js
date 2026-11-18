import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {assertPreviewEnvironment} from '../src/security/preview-environment.js';
const valid=()=>({VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_isolated_preview',HMS_PREVIEW_PROJECT_ID:'prj_isolated_preview',HMS_PREVIEW_DATABASE_HOST:'ep-fixture-123.eu-central-1.aws.neon.tech',HMS_PREVIEW_DATABASE_USER:'hms_preview_app',HMS_PREVIEW_DATABASE_NAME:'hms_preview',DATABASE_URL:'postgresql://hms_preview_app:test-only@ep-fixture-123-pooler.eu-central-1.aws.neon.tech/hms_preview?sslmode=require',HMS_PHM_OPERATIONS_SECRET:'hms-preview-test-operations'});
test('production/local behavior remains unchanged even with legacy credentials',()=>{
 for(const VERCEL_ENV of ['production','development',undefined])assert.deepEqual(assertPreviewEnvironment({VERCEL_ENV,DATABASE_URL:'legacy',HMS_API_TOKEN:'live'}),{enforced:false});
});
test('isolated Preview accepts only its endpoint, database, role and distinct admin credentials',()=>{
 assert.equal(assertPreviewEnvironment(valid()).enforced,true);
 for(const change of [{DATABASE_URL:'postgresql://hms_preview_app:never-log-this@ep-other-456.eu-central-1.aws.neon.tech/hms_preview?sslmode=require'},{HMS_PREVIEW_PROJECT_ID:'prj_BlCu86WpDG3wOoF6BC3GGpMJccHw'},{VERCEL_PROJECT_ID:'prj_other'},{HMS_PREVIEW_DATABASE_HOST:''},{DATABASE_URL:''},{DATABASE_URL:valid().DATABASE_URL.replace('hms_preview_app','neondb_owner')},{DATABASE_URL:valid().DATABASE_URL.replace('/hms_preview?','/neondb?')},{DATABASE_URL:valid().DATABASE_URL.replace('sslmode=require','sslmode=disable')},{POSTGRES_URL:'postgresql://owner:secret@ep-production-999.eu-central-1.aws.neon.tech/neondb?sslmode=require'},{PGHOST:'ep-production-999.eu-central-1.aws.neon.tech'},{PGUSER:'owner'},{HMS_PHM_OPERATIONS_SECRET:'production-admin-code'},{HMS_API_TOKEN:'live'},{HMS_EUCHL_API_TOKEN:'live'},{HMS_PHM_REGISTRATIONS_API_TOKEN:'live'},{OPENAI_API_KEY:'live'},{BLOB_READ_WRITE_TOKEN:'live'},{SUPABASE_SERVICE_ROLE_KEY:'live'},{CRON_SECRET:'live'},{HMS_BOOTSTRAP_DATABASE_URL:'temporary-owner'}]){
  assert.throws(()=>assertPreviewEnvironment({...valid(),...change}),e=>e.code==='HMS_PREVIEW_ISOLATION_REQUIRED'&&!e.message.includes('never-log-this')&&!e.message.includes('postgresql://'));
 }
});
test('Preview fails closed without configuration, before any network operation',()=>{
 assert.throws(()=>assertPreviewEnvironment({VERCEL_ENV:'preview'}),/Preview isolation/);
 const p=execFileSync(process.execPath,['--input-type=module','-e',"try{await import('./src/security/preview-environment.js');process.exit(2)}catch(e){if(e.code!=='HMS_PREVIEW_ISOLATION_REQUIRED')throw e;}"],{env:{...process.env,VERCEL_ENV:'preview',HMS_PREVIEW_PROJECT_ID:''}});
 assert.equal(p.length,0);
});
test('all public API, build and operational entrypoints execute the guard',async()=>{
 const files=execFileSync('git',['ls-files','api'],{encoding:'utf8'}).trim().split(/\r?\n/);
 for(const file of [...files,'src/server.js','scripts/build-media-client.js','scripts/ingest.js','scripts/seed-sql.js']){
  const source=await readFile(file,'utf8');assert.match(source.split(/\r?\n/)[0],/^import ['"].*security\/preview-environment\.js['"];$/,file);
 }
});
