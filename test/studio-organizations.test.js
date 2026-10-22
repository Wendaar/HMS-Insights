import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationRegistry,organizationConfig,publicOrganizations,PHM_ORGANIZATION_ID} from '../src/app/organizations.js';
import {createStudioHandler} from '../src/web/studio-handler.js';
import {createHmsWebhookHandler} from '../src/web/hms-webhook-handler.js';
import {browseMedia,mediaGame} from '../src/app/media-engine.js';
import {loadPublicFeed,loadPublicFeedOptions,loadPublicFeedPage,loadPublicSelection,loadPlayerSeasonRecords} from '../src/infrastructure/postgres-repository.js';
import {backfillFinishedGames} from '../src/app/backfill-finished-games.js';
import {studioOrganization,studioUrl} from '../public/studio/routing.js';
import {t,normalizeLanguage,filterLabel,insightDescription,insightTitle} from '../public/studio/i18n.js';
import {insightStat} from '../public/studio/subjects.js';
import {templates,gameOutputs} from '../public/studio/graphics.js';
const other='11111111-1111-1111-1111-111111111111';
const gameId='22222222-2222-2222-2222-222222222222';
const env={HMS_API_TOKEN:'PHM-TOKEN-SENTINEL',HMS_WEBHOOK_SECRET:'PHM-SECRET-SENTINEL',HMS_STUDIO_ORGANIZATIONS:JSON.stringify([{code:'YELLOW',slug:'yellow',name:'Yellow Hockey'},{code:'FLLLH',slug:'flllh',name:'FLLLH'}]),HMS_YELLOW_ORGANIZATION_ID:other,HMS_YELLOW_API_TOKEN:'YELLOW-TOKEN-SENTINEL',HMS_YELLOW_WEBHOOK_SECRET:'YELLOW-SECRET-SENTINEL'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('server registry extends existing orgs, scoped credentials never borrow PHM token/secret',()=>{
 const org=organizationConfig('yellow',env);assert.equal(org.id,other);assert.equal(org.code,'YELLOW');assert.equal(org.token,env.HMS_YELLOW_API_TOKEN);assert.equal(org.webhookSecret,env.HMS_YELLOW_WEBHOOK_SECRET);
 assert.equal(organizationConfig('PHM',env).id,PHM_ORGANIZATION_ID);
 const missing=organizationConfig('YELLOW',{...env,HMS_YELLOW_API_TOKEN:'',HMS_YELLOW_WEBHOOK_SECRET:''});assert.equal(missing.token,undefined);assert.equal(missing.webhookSecret,undefined);
 assert.throws(()=>organizationConfig('FLLLH',env));assert.throws(()=>organizationConfig('DATABASE_URL',env));assert.throws(()=>organizationConfig(['PHM'],env));
 for(const registry of ['{', '{}',JSON.stringify([{code:'PHM',slug:'../../',name:'Bad'}]),JSON.stringify([{code:'evil',slug:'evil',name:'Bad'}]),JSON.stringify([{code:'NEW',slug:'phm',name:'Duplicate'}])])assert.throws(()=>organizationRegistry({...env,HMS_STUDIO_ORGANIZATIONS:registry}));
});
test('read-only public catalog contains just code, slug, name, configured; errors do not expose configuration',async()=>{
 const expected=publicOrganizations(env);assert.equal(expected.find(o=>o.code==='YELLOW').configured,true);assert.equal(expected.find(o=>o.code==='FLLLH').configured,false);
 assert.ok(expected.every(o=>Object.keys(o).sort().join(',')==='code,configured,name,slug'));
 const res=response();await createStudioHandler({env})({method:'GET',query:{catalog:'1'}},res);assert.equal(res.code,200);assert.deepEqual(res.body.organizations,expected);assert.doesNotMatch(JSON.stringify(res.body),/SENTINEL|11111111|API_TOKEN|WEBHOOK_SECRET/);
 const bad=response();await createStudioHandler({env})({method:'GET',query:{org:'yellow',lang:'en',offset:'NaN'}},bad);assert.equal(bad.code,400);assert.match(bad.body.error,/Invalid/);
 const backend=response();await createStudioHandler({browseMedia:async()=>{throw new TypeError('PRIVATE_SENTINEL');}})({method:'GET',query:{org:'PHM'}},backend);assert.equal(backend.code,503);assert.doesNotMatch(JSON.stringify(backend.body),/SENTINEL/);
});
test('deep links are case-insensitive, preserve language, unknown paths never silently select PHM',()=>{
 const catalog=publicOrganizations(env);
 assert.equal(studioOrganization('/studio',catalog).code,'PHM');assert.equal(studioOrganization('/studio/PHM',catalog).code,'PHM');assert.equal(studioOrganization('/studio/Yellow/',catalog).code,'YELLOW');
 for(const path of ['/studio/unknown','/studio/../PHM','/studio/phm/other','/studio/app.js'])assert.equal(studioOrganization(path,catalog),null);
 assert.equal(studioUrl(catalog.find(o=>o.code==='YELLOW'),'en'),'/studio/yellow?lang=en');assert.equal(studioUrl(catalog[0],'xx'),'/studio/phm?lang=cs');assert.throws(()=>studioUrl({slug:'//evil.com'},'en'));
});
test('each organization browses only its own UUID using its own token, including on paged Today requests',async()=>{
 for(const code of ['PHM','YELLOW']){
  const config=organizationConfig(code,env);
  const options={env,now:new Date('2026-10-24T22:30Z'),fetchGames:async(params,{config:hms})=>{assert.equal(hms.token,config.token);assert.deepEqual(params,{from:'2026-10-25',to:'2026-10-25',status:'ALL',limit:20,skip:20});return [{gameId,organizationId:config.id,startDate:'2026-10-25',HomeTeam:{name:code+' Home'},AwayTeam:{name:code+' Away'}}];}};
  const page=await browseMedia({org:code,offset:20},options);assert.equal(page.items[0].home.name,code+' Home');
  await assert.rejects(browseMedia({org:code},{...options,fetchGames:async()=>[{gameId,organizationId:code==='PHM'?other:PHM_ORGANIZATION_ID,startDate:'2026-10-25'}]}),/organizaci/);
 }
});
test('snapshot and cached game details cannot cross organizations or survive a reassigned org UUID',async()=>{
 const {gameEventsResponse,lineupResponse,ids}=await import('../src/fixtures/real-game-sanitized.js');
 const options={env,fetchMetadata:async()=>null,fetchOrganization:async()=>null,fetchBrandingDetail:async()=>null,fetchResponses:async()=>[gameEventsResponse,gameEventsResponse,lineupResponse,null]};
 const result=await mediaGame('PHM',ids.game,options);assert.equal(result.org,'PHM');
 await assert.rejects(mediaGame('YELLOW',ids.game,options),/organizaci/);
 await assert.rejects(mediaGame('PHM',ids.game,{...options,env:{...env,HMS_PHM_ORGANIZATION_ID:other}}),/organizaci/);
});
test('org webhooks require their own secret and bind both notification and fetched result to configured UUID',async()=>{
 const calls=[];const handler=createHmsWebhookHandler({env,processGame:async(id,options)=>{calls.push({id,options});return {gameId:id};}});
 const request=(org,secret,organizationId=other)=>({method:'POST',query:{org},headers:{authorization:'Bearer '+secret},body:{type:'game.finished',gameId,organizationId}});
 let res=response();await handler(request('yellow',env.HMS_WEBHOOK_SECRET),res);assert.equal(res.code,401);assert.equal(calls.length,0);
 res=response();await handler(request('yellow',env.HMS_YELLOW_WEBHOOK_SECRET,PHM_ORGANIZATION_ID),res);assert.equal(res.code,422);assert.equal(calls.length,0);
 res=response();await handler(request('yellow',env.HMS_YELLOW_WEBHOOK_SECRET),res);assert.equal(res.code,200);assert.equal(calls[0].options.config.token,env.HMS_YELLOW_API_TOKEN);assert.equal(calls[0].options.expectedOrganizationId,other);assert.doesNotMatch(JSON.stringify(res.body),/SENTINEL/);
 res=response();await handler(request('unknown',env.HMS_WEBHOOK_SECRET),res);assert.equal(res.code,404);
 res=response();await handler({...request('yellow',env.HMS_YELLOW_WEBHOOK_SECRET),body:'{'},res);assert.equal(res.code,400);
 res=response();await handler({...request('yellow',env.HMS_YELLOW_WEBHOOK_SECRET),body:{type:'ping'}},res);assert.equal(res.code,200);
 res=response();await handler({...request('yellow',env.HMS_YELLOW_WEBHOOK_SECRET),body:{type:'game.started',organizationId:other}},res);assert.equal(res.code,202);
 // Legacy PHM URL keeps working but cannot import another organization's game.
 res=response();await handler(request(undefined,env.HMS_WEBHOOK_SECRET,PHM_ORGANIZATION_ID),res);assert.equal(res.code,200);assert.equal(calls[1].options.expectedOrganizationId,PHM_ORGANIZATION_ID);
 const {processFinishedGame}=await import('../src/app/process-finished-game.js');
 const {gameEventsResponse,lineupResponse,ids}=await import('../src/fixtures/real-game-sanitized.js');let persisted=false;
 await assert.rejects(processFinishedGame(ids.game,{expectedOrganizationId:other,fetchResponses:async()=>[gameEventsResponse,lineupResponse],persist:async()=>{persisted=true;}}),/organizace/);assert.equal(persisted,false);
});
test('history import rejects an entire foreign page before any persistence',async()=>{
 let processed=false;
 await assert.rejects(backfillFinishedGames({organizationId:other,loadGames:async()=>[{gameId,organizationId:PHM_ORGANIZATION_ID}],processGame:async()=>{processed=true;}}),/organizaci/);assert.equal(processed,false);
});
test('public PHM selection, archive, count, filters and season stats remain org-scoped without schema changes',async()=>{
 for(const load of [loadPublicFeed,loadPublicFeedOptions,loadPublicFeedPage,loadPublicSelection]){
  const calls=[];await load({organizationId:other,sql:{query:async(text,values)=>{calls.push({text,values});return [];}}});
  for(const call of calls){assert.match(call.text,/organization_id=\$\d+::uuid/);assert.ok(call.values.includes(other));}
  if(load===loadPublicSelection)assert.equal((calls[0].text.match(/organization_id=/g)||[]).length,2,'latest game date and selected games share org scope');
 }
 let text;await loadPlayerSeasonRecords(gameId,'skater',{sql:{query:async q=>{text=q;return [];}}});assert.match(text,/g.organization_id=s.organization_id/);
});
test('CS/EN presentation translates periods and known achievement facts without altering names or guessing missing counters',()=>{
 assert.equal(normalizeLanguage('de'),'cs');assert.equal(filterLabel('Today','en'),'Today');assert.equal(filterLabel('Today','cs'),'Dnes');assert.equal(t('PŘINÁŠÍ',{},'en'),'PRESENTS');
 assert.equal(insightStat({type:'HATTRICK',stats:{goals:3}},'en').label,'GOALS');assert.equal(insightDescription({type:'HATTRICK',text:'Český text',stats:{goals:3}},null,'en'),'3 goals.');assert.equal(insightDescription({type:'HATTRICK',text:'Český text'},null,'en'),'Hattrick performance.');
 assert.equal(insightDescription({type:'HATTRICK',text:'Český text'},null,'cs'),'Český text');assert.equal(insightTitle({type:'EARLY_GOAL',title:'Rychlý gól'},'en'),'Early goal');
 const g={status:'FINISHED',home:{score:2},away:{score:1},timeline:{coverage:'matches-result',periodScores:[{period:1,home:1,away:1}]}};
 assert.equal(templates(g,'en')[1].heading,'END OF PERIOD 1');assert.equal(templates(g,'cs')[1].heading,'PO 1. TŘETINĚ');assert.deepEqual(templates({...g,status:'NOT PLAYED'},'en'),[]);assert.deepEqual(gameOutputs({...g,status:'RUNNING'},'en'),[]);
});
