import test from 'node:test';
import assert from 'node:assert/strict';
import {matchLinks,comparisonDestination} from '../src/app/match-links.js';
import {publicPregame} from '../src/app/public-pregame.js';
import {createMatchPreviewHandler} from '../src/web/match-preview-handler.js';
import {createGameReportHandler} from '../src/web/game-report-handler.js';
import {renderMatchPreviewPage} from '../src/web/match-preview-page.js';
import {invitationText} from '../public/studio/game-day-invitation.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const game={org:'PHM',gameId:id(1),seasonId:id(2),groupId:id(3),phaseId:id(4),date:'2026-11-01',time:'20:00',status:'NOT PLAYED',venue:'SPM Aréna',home:{id:id(5),name:'Home'},away:{id:id(6),name:'Away'}};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(body){this.body=body;},json(body){this.body=body;}});
test('comparison invitations use the existing direct route with the exact teams and competition scope',()=>{
 const links=matchLinks('phm',game,{env:{}});assert.equal(new URL(links.game).pathname,`/m/phm/${id(1)}`);assert.equal(links.compare,new URL(comparisonDestination('phm',game),'https://app.phmcup.cz').href);assert.equal(matchLinks('phm',{...game,phaseId:null}).compare,null);assert.equal(matchLinks('phm',{...game,home:game.away}).compare,null);
 const target=new URL(comparisonDestination('phm',game,'en'),'https://app.phmcup.cz');assert.equal(target.searchParams.get('left'),id(5));assert.equal(target.searchParams.get('right'),id(6));assert.equal(target.searchParams.get('phaseId'),id(4));assert.equal(target.searchParams.get('lang'),'en');assert.throws(()=>comparisonDestination('phm',{...game,home:game.away}));
});
test('preview match details stay on the deployment containing the pregame page; production stays canonical',()=>{
 const env={VERCEL_ENV:'preview',VERCEL_BRANCH_URL:'hms-insights-git-feature-wendaar.vercel.app',VERCEL_URL:'hms-insights-unique-wendaar.vercel.app'};
 const links=matchLinks('phm',game,{env});assert.equal(new URL(links.game).hostname,env.VERCEL_BRANCH_URL);assert.equal(new URL(links.compare).hostname,'app.phmcup.cz');
 assert.equal(new URL(matchLinks('phm',game,{env:{...env,VERCEL_BRANCH_URL:'',VERCEL_URL:env.VERCEL_URL}}).game).hostname,env.VERCEL_URL);
 for(const host of ['evil.test','app.vercel.app.evil.test','user@evil.vercel.app','ok.vercel.app/path'])assert.equal(new URL(matchLinks('phm',game,{env:{...env,VERCEL_BRANCH_URL:host}}).game).hostname,'app.phmcup.cz');
 assert.equal(new URL(matchLinks('phm',game,{env:{...env,VERCEL_ENV:'production'}}).game).hostname,'app.phmcup.cz');
});
test('analysis redirect loads the organization-scoped fixture and selects its actual teams',async()=>{
 let seen;const res=response();await createMatchPreviewHandler({preview:async(org,id,options)=>{seen={org,id,includeComparison:options.includeComparison};return game;}})({method:'GET',query:{org:'phm',gameId:id(1),action:'analysis',lang:'en'}},res);
 assert.equal(res.code,302);assert.deepEqual(seen,{org:'PHM',id:id(1),includeComparison:false});const q=new URL(res.headers.location,'https://app.phmcup.cz').searchParams;assert.equal(q.get('left'),game.home.id);assert.equal(q.get('right'),game.away.id);assert.equal(q.get('seasonId'),game.seasonId);
 const bad=response();await createMatchPreviewHandler({preview:async()=>assert.fail('foreign organization must fail first')})({method:'GET',query:{org:'unknown',gameId:id(1)}},bad);assert.equal(bad.code,400);
});
test('old Game Center HTML opens public pregame basics before import; JSON remains 404',async()=>{
 const loadPregame=async()=>game;
 const html=response();await createGameReportHandler({loadSummary:async()=>null,loadPregame})({method:'GET',query:{gameId:id(1)}},html);assert.equal(html.code,200);assert.match(html.body,/SPM Aréna/);assert.match(html.body,/20:00/);assert.doesNotMatch(html.body,/>0:0</);
 const json=response();await createGameReportHandler({json:true,loadSummary:async()=>null,loadPregame:async()=>assert.fail('JSON must not run fallback')})({method:'GET',query:{gameId:id(1)}},json);assert.equal(json.code,404);
});
test('public fallback projects sporting basics only, rejects foreign response IDs and escapes source labels',async()=>{
 const data={gameId:id(1),startDate:'2026-11-01',startTime:'20:00:00',status:'NOT PLAYED',HomeTeam:{name:'<script>Home</script>'},AwayTeam:{name:'Away'},Venue:{name:'SPM Aréna'},email:'PRIVATE_SENTINEL'};
 const p=await publicPregame(id(1),{fetchMetadata:async()=>data});assert.equal(p.time,'20:00');assert.equal(p.email,undefined);const html=renderMatchPreviewPage(p);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|PRIVATE_SENTINEL/);
 assert.equal(await publicPregame(id(1),{fetchMetadata:async()=>({...data,gameId:id(9)})}),null);
});
test('new analysis text is included even for a previously saved template and localizes the target',()=>{
 const text=invitationText({...game,links:matchLinks('phm',game)},{en:true,template:'Old template: {home}'});assert.match(text,/More match analysis:/);const url=new URL(text.split('More match analysis: ')[1]);assert.equal(url.pathname,'/team-comparison/phm');assert.equal(url.searchParams.get('lang'),'en');assert.equal(url.searchParams.get('left'),game.home.id);assert.equal(url.searchParams.get('right'),game.away.id);
});
