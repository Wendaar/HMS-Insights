import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrganizationImportHandler} from '../src/web/organization-import-handler.js';
import {createOrganizationImportPage} from '../src/web/organization-import-page.js';
import {backfillFinishedGamesPage} from '../src/app/backfill-finished-games.js';
import {PHM_ORGANIZATION_ID} from '../src/app/organizations.js';
const other='11111111-1111-1111-1111-111111111111',gameId='22222222-2222-2222-2222-222222222222';
const env={HMS_API_TOKEN:'PHM-TOKEN-SENTINEL',HMS_WEBHOOK_SECRET:'PHM-SECRET-SENTINEL',HMS_EUCHL_ORGANIZATION_ID:other,HMS_EUCHL_API_TOKEN:'EUCHL-TOKEN-SENTINEL',HMS_EUCHL_WEBHOOK_SECRET:'EUCHL-SECRET-SENTINEL'};
const res=()=>({headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;}});
const request=(org='EUCHL',body={gameId},secret=env.HMS_EUCHL_WEBHOOK_SECRET)=>({method:'POST',query:{org},headers:{authorization:'Bearer '+secret},body});
const now=new Date('2026-10-22T12:00Z'),window={from:'2026-10-01',to:'2026-10-22',skip:0};
test('manual and history imports authenticate per org before any fetch/schema/write; PHM default stays compatible',async()=>{
 for(const batch of [false,true]){
  let changed=false;const handler=createOrganizationImportHandler({batch,env,now,ensureSchema:async()=>{changed=true;}});
  for(const [req,code] of [[request('EUCHL',batch?window:{gameId},env.HMS_WEBHOOK_SECRET),401],[request('unknown'),404],[request(['PHM','EUCHL']),404],[{...request(),method:'GET'},405]]){const r=res();await handler(req,r);assert.equal(r.code,code);assert.equal(changed,false);assert.doesNotMatch(JSON.stringify(r.body),/SENTINEL/);}
 }
 let scope;const r=res();await createOrganizationImportHandler({env,ensureSchema:async()=>{},processGame:async(id,options)=>{scope=options;return {gameId:id,score:'2:1',priklepy:1};}})({...request(),query:{},headers:{authorization:'Bearer '+env.HMS_WEBHOOK_SECRET}},r);
 assert.equal(r.code,200);
 assert.equal(scope.expectedOrganizationId,PHM_ORGANIZATION_ID);assert.equal(scope.config.token,env.HMS_API_TOKEN);
});
test('single import uses scoped token and UUID and returns only safe result fields',async()=>{
 let scope;const r=res();await createOrganizationImportHandler({env,ensureSchema:async()=>{},processGame:async(id,options)=>{scope=options;return {gameId:id,score:'9:3',priklepy:10,private:env.HMS_API_TOKEN};}})(request(),r);assert.equal(r.code,200);assert.equal(scope.config.token,env.HMS_EUCHL_API_TOKEN);assert.equal(scope.expectedOrganizationId,other);assert.equal(r.body.organization,'EUCHL');assert.doesNotMatch(JSON.stringify(r.body),/SENTINEL|private/);
});
test('history import passes bounded calendar dates, FINISHED pipeline scope, one-game page and safe failures',async()=>{
 let scope;const r=res();await createOrganizationImportHandler({batch:true,env,now,ensureSchema:async()=>{},backfill:async options=>{scope=options;return {discovered:1,processed:0,failed:1,skip:20,nextSkip:21,done:false,failures:[{gameId,error:'PRIVATE-SENTINEL'}]};}})(request('EUCHL',{...window,skip:20}),r);
 assert.equal(r.code,200);assert.equal(scope.organizationId,other);assert.equal(scope.expectedOrganizationId,other);assert.equal(scope.config.token,env.HMS_EUCHL_API_TOKEN);assert.equal(scope.limit,1);assert.equal(scope.skip,20);assert.equal(scope.from,window.from);assert.equal(scope.to,window.to);assert.doesNotMatch(JSON.stringify(r.body),/SENTINEL/);
});
test('malformed JSON, invalid IDs/dates, future dates, unbounded non-PHM range and invalid offsets fail before schema/write',async()=>{
 let writes=0;const options={env,now,ensureSchema:async()=>{writes++;}};
 const single=createOrganizationImportHandler(options),batch=createOrganizationImportHandler({...options,batch:true});
 for(const body of ['{',null,[],{gameId:'bad'}]){const r=res();await single(request('EUCHL',body),r);assert.equal(r.code,400);}
 for(const body of [{...window,from:'2026-02-30'},{...window,to:'2026-10-23'},{...window,to:'2026-09-30'},{...window,from:'2026-09-01'},{...window,to:undefined,seasonId:gameId},{...window,skip:-1},{...window,skip:1.5},{...window,seasonId:'bad'}]){const r=res();await batch(request('EUCHL',body),r);assert.equal(r.code,400);}
 assert.equal(writes,0);
});
test('backfill refuses foreign org, out-of-range and oversized HMS pages before processing anything',async()=>{
 let written=false;
 for(const page of [[{gameId,organizationId:PHM_ORGANIZATION_ID,startDate:'2026-10-20'}],[{gameId,organizationId:other,startDate:'2026-09-30'}],Array.from({length:2},()=>({gameId,organizationId:other,startDate:'2026-10-20'}))])await assert.rejects(backfillFinishedGamesPage({organizationId:other,...window,limit:1,loadGames:async()=>page,processGame:async()=>{written=true;}}));
 assert.equal(written,false);
});
test('import pages contain org identity/links only, not API token or signing secret; unknown org fails closed',()=>{
 for(const batch of [false,true]){const r=res();createOrganizationImportPage({env,now,batch})({method:'GET',query:{org:'EUCHL'}},r);assert.equal(r.code,200);assert.match(r.body,/EUCHL/);assert.match(r.body,/\/api\/admin\/(backfill|import-game)\?org=EUCHL/);assert.match(r.body,/href="\/priklepy\/euchl"/);assert.doesNotMatch(r.body,/SENTINEL|11111111-1111|HMS_EUCHL_API_TOKEN/);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['referrer-policy'],'no-referrer');}
 const r=res();createOrganizationImportPage({env})({method:'GET',query:{org:'unknown'}},r);assert.equal(r.code,404);
});
test('backend errors never expose connection/secret details and failed import does not claim success',async()=>{
 const r=res();await createOrganizationImportHandler({env,ensureSchema:async()=>{},processGame:async()=>{throw new Error('PRIVATE-SENTINEL');}})(request(),r);assert.equal(r.code,422);assert.equal(r.body.imported,false);assert.doesNotMatch(JSON.stringify(r.body),/SENTINEL/);
});
