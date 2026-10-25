import test from 'node:test';
import assert from 'node:assert/strict';
import {controlContextCatalog,controlGameCatalog} from '../src/app/control-context.js';
import {loadControlLeagues,loadControlGames} from '../src/infrastructure/postgres-repository.js';
import {createStudioHandler} from '../src/web/studio-handler.js';
import {createToolsHandler} from '../src/web/tools-handler.js';
const org='BB669217-41EB-4162-8040-A73F49A43570',season='E6134160-47CF-11F1-A223-BFDFBDD3A64B',game='F6321894-98CA-11F1-8BDF-EF2495D048F3';
const row={organization_id:org,season_id:season,competition_name:'PHM Cup',season_name:'2026–2027',private_token:'do-not-return'};
const response=()=>({setHeader(){},status(n){this.code=n;return this;},json(data){this.body=data;return this;}});
test('named season catalog retains identity and rejects cross-organization rows',async()=>{
 const options={env:{},loadLeagues:async()=>[row,row]};
 const result=await controlContextCatalog('PHM',options);assert.equal(result.items.length,1);assert.equal(result.items[0].name,'PHM Cup · 2026–2027');assert.equal(result.items[0].seasonId,season.toLowerCase());assert.ok(!JSON.stringify(result).includes('do-not-return'));
 await assert.rejects(controlContextCatalog('PHM',{...options,loadLeagues:async()=>[{...row,organization_id:game}]}));
 await assert.rejects(controlContextCatalog('unknown',options));
});
test('named game choices are bound to organization and season',async()=>{
 const options={env:{},loadControlGames:async()=>[{...row,game_id:game,played_on:'2026-10-24',home_team_name:'Domácí',away_team_name:'Hosté'}]};
 const result=await controlGameCatalog('PHM',season,options);assert.equal(result.items[0].label,'Domácí — Hosté · 2026-10-24');assert.equal(result.items[0].gameId,game);
 await assert.rejects(controlGameCatalog('PHM','bad',options));
 await assert.rejects(controlGameCatalog('PHM',game,options));
});
test('context queries are bounded and organization-scoped; API sanitizes failures',async()=>{
 const calls=[],sql={query:async(query,values)=>{calls.push({query,values});return [];}};
 await loadControlLeagues(org,{sql});await loadControlGames(org,season,{sql});
 assert.deepEqual(calls[0].values,[org]);assert.match(calls[0].query,/organization_id=\$1::uuid/);assert.match(calls[0].query,/limit 300/);
 assert.deepEqual(calls[1].values,[org,season]);assert.match(calls[1].query,/season_id=\$2::uuid/);assert.match(calls[1].query,/limit 100/);
 const handler=createStudioHandler({env:{},loadLeagues:async()=>{throw Error('private SQL/token');}}),res=response();
 await handler({method:'GET',query:{catalog:'leagues',org:'PHM'}},res);assert.equal(res.code,503);assert.ok(!JSON.stringify(res.body).includes('private'));
});
test('access status returns configuration only; management still needs a correct code',async()=>{
 const env={HMS_PHM_TOOLS_ADMIN_SECRET:'private-code'},handler=createToolsHandler({env}),res=response();
 await handler({method:'GET',query:{action:'access',org:'PHM'},headers:{}},res);
 assert.deepEqual(res.body,{org:'PHM',configured:true});assert.ok(!JSON.stringify(res.body).includes('private-code'));
 const denied=response();await handler({method:'GET',query:{action:'manage',org:'PHM'},headers:{}},denied);assert.equal(denied.code,401);
 const off=response();await createToolsHandler({env:{}})({method:'GET',query:{action:'access',org:'PHM'},headers:{}},off);assert.deepEqual(off.body,{org:'PHM',configured:false});
});
