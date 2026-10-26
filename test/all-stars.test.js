import test from 'node:test';
import assert from 'node:assert/strict';
import {allStarsScope,allStarsSettings,nominateAllStars,resolvedSelection,readAllStars} from '../src/app/all-stars.js';
import {createAllStarsHandler} from '../src/web/all-stars-handler.js';
import {toolStore} from '../src/infrastructure/tool-instances.js';
import {loadAllStarsGames} from '../src/infrastructure/postgres-repository.js';
import {sampleAnalysis} from '../src/app/sample.js';
import {rowsFor} from '../src/infrastructure/analysis-rows.js';
import {server} from '../src/server.js';
import {readFile} from 'node:fs/promises';
const r=rowsFor(sampleAnalysis),snapshot={game:r.games[0],teams:r.team_game_stats,players:r.player_game_stats,goalies:r.goalie_game_stats};
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const scope={seasonId:snapshot.game.season_id.toLowerCase(),month:snapshot.game.played_on.slice(0,7),groupId:snapshot.game.group_id.toLowerCase()};
const fixture={id:snapshot.game.game_id.toLowerCase(),status:'FINISHED',date:snapshot.game.played_on,home:{id:snapshot.game.home_team_id.toLowerCase(),name:snapshot.game.home_team_name,score:snapshot.game.home_score},away:{id:snapshot.game.away_team_id.toLowerCase(),name:snapshot.game.away_team_name,score:snapshot.game.away_score},group:{id:scope.groupId,name:'Test division'}};
const settings=()=>allStarsSettings({...scope,title:'Test lineup',selection:{F:[],D:[],G:[]}});
export function allStarsMemoryStore(){const entries=new Map();return {async get(o,s){return structuredClone(entries.get(o+':'+s)??null);},async list(o){return [...entries].filter(([k])=>k.startsWith(o+':')).map(([k,v])=>({slug:k.split(':')[1],title:v.draft.title,revision:v.revision,published:!!v.published}));},async save(o,s,d,rev){const key=o+':'+s,old=entries.get(key);if((old?.revision??0)!==rev)return null;const value={draft:structuredClone(d),published:old?.published??null,publishedAt:old?.publishedAt,revision:rev+1};entries.set(key,value);return structuredClone(value);},async publish(o,s,rev){const key=o+':'+s,item=entries.get(key);if(!item||item.revision!==rev)return null;item.published=structuredClone(item.draft);item.revision++;item.publishedAt='2026-10-01';return structuredClone(item);}};}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;}};}
async function call(handler,action,body,extra={}){const res=response();await handler({method:body?'POST':'GET',query:{org:'phm',instance:'test-lineup',action,...extra.query},headers:{authorization:'Bearer code',host:'localhost',...extra.headers},body,...(extra.method?{method:extra.method}:{})},res);return res;}
test('calendar scope and lineup validation reject invalid months, IDs, duplicates and missing division',()=>{
 for(const month of ['2026-00','2026-13','2026-2','foo'])assert.throws(()=>allStarsScope({...scope,month}));
 assert.throws(()=>allStarsSettings({...settings(),groupId:''}));assert.throws(()=>allStarsSettings({...settings(),title:'<script>'}));
 const p=id(1)+'|'+id(2);assert.throws(()=>allStarsSettings({...settings(),selection:{F:[p],D:[p],G:[]}}));
 assert.deepEqual(allStarsSettings({...settings(),apiToken:'drop'}),settings());
});
test('monthly nominations separate player/team, preserve unknown positions, and flag incomplete or stale games',()=>{
 const data=nominateAllStars([snapshot],[fixture],scope);assert.equal(data.coverage.complete,true);assert.ok(data.candidates.F.length);assert.equal(data.candidates.F[0].positionUnverified,true);
 assert.equal(data.candidates.F.length,data.candidates.D.length);
 const dual=structuredClone(snapshot);dual.goalies[0].player_id=dual.players[0].player_id;dual.goalies[0].team_id=dual.players[0].team_id;
 const dualData=nominateAllStars([dual],[fixture],scope);const dualId=dual.players[0].player_id.toLowerCase()+'|'+dual.players[0].team_id.toLowerCase();assert.ok(dualData.candidates.F.some(p=>p.id===dualId));assert.ok(dualData.candidates.G.some(p=>p.id===dualId));
 assert.equal(nominateAllStars([],[fixture],scope).coverage.missing.length,1);
 assert.equal(nominateAllStars([snapshot],[{...fixture,home:{...fixture.home,score:999}}],scope).coverage.complete,false);
 const bad=structuredClone(snapshot);bad.game.event_snapshot=null;const historical=nominateAllStars([bad],[fixture],scope);assert.equal(historical.coverage.verifiedByTotals,1);assert.equal(historical.coverage.complete,true);assert.ok(historical.candidates.G.every(g=>g.sv===null));
 bad.players[0].goals+=1;assert.equal(nominateAllStars([bad],[fixture],scope).coverage.unsuitable,1);
 const other=JSON.parse(JSON.stringify(snapshot).replaceAll(snapshot.game.home_team_id,id(101)).replaceAll(snapshot.game.home_team_id.toLowerCase(),id(101)));other.game.game_id=id(100);other.game.home_team_id=id(101);other.teams.find(t=>t.side==='HOME').team_id=id(101);for(const p of other.players)if(p.team_id===snapshot.game.home_team_id)p.team_id=id(101);
 const second={...fixture,id:id(100),home:{...fixture.home,id:id(101)}};
 const multiple=nominateAllStars([snapshot,other],[fixture,second],scope);
 const first=data.candidates.F.find(p=>p.teamId===fixture.home.id);assert.ok(multiple.candidates.F.some(p=>p.playerId===first.playerId&&p.teamId===id(101)));assert.equal(multiple.candidates.F.find(p=>p.id===first.id).gp,1);
});
test('shared monthly reader verifies organization/season and requests exactly calendar dates',async()=>{
 const env={HMS_PHM_ORGANIZATION_ID:snapshot.game.organization_id},dates=[];
 const options={env,now:new Date('2026-12-01'),loadLeagues:async()=>[{organization_id:snapshot.game.organization_id,season_id:scope.seasonId,competition_name:'Test',season_name:'Test season'}],loadAllStarsGames:async()=>[],readDay:async(season,date)=>{dates.push(date);return [];}};
 const result=await readAllStars('phm',{...scope,groupId:''},options);assert.equal(result.coverage.expected,0);assert.ok(dates.every(d=>d.startsWith(scope.month)));assert.equal(dates[0],scope.month+'-01');assert.equal(new Set(dates).size,dates.length);assert.equal(result.monthClosed,true);
 await assert.rejects(readAllStars('phm',{...scope,groupId:''},{...options,loadAllStarsGames:async()=>[{game:{...snapshot.game,organization_id:id(999)}}]}),/context mismatch/);
 await assert.rejects(readAllStars('phm',{...scope,seasonId:id(999)},options),TypeError);
});
test('monthly SQL and instance storage retain separate organization and tool parameters',async()=>{
 let query,args;await loadAllStarsGames(id(1),id(2),'2026-09-01','2026-09-30',{sql:{async query(q,a){query=q;args=a;return [];}}});assert.match(query,/organization_id=\$1::uuid and season_id=\$2::uuid/);assert.deepEqual(args,[id(1),id(2),'2026-09-01','2026-09-30']);
 const store=toolStore({tool:'all-stars',sql:{async query(q,a){assert.equal(a[0],'all-stars');assert.equal(a[1],'EUCHL');return [];}}});await store.get('EUCHL','test');await store.list('EUCHL');
});
export function browserAllStarsData(){const candidates={F:[],D:[],G:[]};let n=1;for(const [role,count]of Object.entries({F:3,D:2,G:1}))for(let i=0;i<count;i++){const playerId=id(n++);candidates[role].push({id:playerId+'|'+id(20),playerId,teamId:id(20),team:'TEST fixture team',name:`TEST fixture ${role}${i}`,role,gp:2,points:4,goals:2,assists:2,pim:0,sv:role==='G'?.9:null,saves:18,ga:2,coverage:1,eligible:true,positionUnverified:false,score:10});}return {org:'PHM',scope:{...scope},season:{name:'TEST season'},groups:[{id:scope.groupId,name:'TEST division'}],candidates,coverage:{expected:2,imported:2,usable:2,missing:[],unsuitable:0,complete:true},monthClosed:true,source:'TEST sporting fixtures',readAt:'2026-10-01T00:00:00Z',rules:'calendar-manual-v1'};}
test('management requires organization access; publication revalidates completeness and freezes only the selected sporting output',async()=>{
 const store=allStarsMemoryStore();let data=browserAllStarsData();const handler=createAllStarsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'code'},store,readAllStars:async()=>structuredClone(data)});
 assert.equal((await call(handler,'manage',undefined,{headers:{authorization:''}})).code,401);
 assert.equal((await call(handler,'manage',undefined,{query:{org:'euchl'}})).code,503);
 assert.equal((await call(handler,'manage',undefined,{headers:{origin:'https://foreign.test'}})).code,403);
 assert.equal((await call(handler,'public')).code,404);
 const config={...settings(),selection:Object.fromEntries(Object.entries(data.candidates).map(([role,list])=>[role,list.map(p=>p.id)]))};
 assert.equal((await call(handler,'save',{revision:0,config})).code,200);
 assert.equal((await call(handler,'save',{revision:0,config})).code,409);
 data.monthClosed=false;assert.equal((await call(handler,'publish',{revision:1})).code,422);
 data.monthClosed=true;data.coverage.complete=false;assert.equal((await call(handler,'publish',{revision:1})).code,422);
 data.coverage.complete=true;assert.equal((await call(handler,'publish',{revision:1})).code,200);
 let publicResult=await call(handler,'public');assert.equal(publicResult.code,200);assert.equal(publicResult.body.output.lineup.F.length,3);assert.equal(publicResult.body.draft,undefined);assert.doesNotMatch(JSON.stringify(publicResult.body),/Bearer|secret|revision|selection/);
 const published=structuredClone(publicResult.body);await call(handler,'save',{revision:3,config:{...config,title:'Changed draft'}});data.candidates.F[0].name='Changed source';publicResult=await call(handler,'public');assert.deepEqual(publicResult.body,published);
 assert.equal((await call(handler,'public',undefined,{query:{org:'euchl'}})).code,404);
 assert.equal((await call(handler,'list')).body.items.length,1);
});
test('malformed bodies, unavailable API and stale candidate IDs fail without publishing or leaking details',async()=>{
 const store=allStarsMemoryStore(),handler=createAllStarsHandler({env:{HMS_PHM_TOOLS_ADMIN_SECRET:'code'},store,readAllStars:async()=>{throw Error('PRIVATE');}});
 assert.equal((await call(handler,'save','{')).code,400);
 const bad=await call(handler,'save',{revision:0,config:settings()});assert.equal(bad.code,503);assert.doesNotMatch(JSON.stringify(bad.body),/PRIVATE/);
 assert.throws(()=>resolvedSelection({...settings(),selection:{F:[id(1)+'|'+id(2)],D:[],G:[]}},browserAllStarsData()),TypeError);
 assert.equal((await call(handler,'public',undefined,{query:{org:'unknown'}})).code,404);
});
test('local and Vercel routes expose the same manager, public result and protected API',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;
 try{for(const path of ['/control/apps/all-stars','/all-stars/phm','/all-stars/phm/test','/all-stars/app.js','/all-stars/app.css'])assert.equal((await fetch(root+path)).status,200,path);
 assert.equal((await fetch(root+'/all-stars/phm',{method:'POST'})).status,405);
 assert.equal((await fetch(root+'/api/all-stars?org=unknown')).status,404);
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));assert.equal(config.rewrites.find(r=>r.source==='/api/all-stars').destination,'/api/game-summary?view=all-stars');
 const ignored=(await readFile(new URL('../.vercelignore',import.meta.url),'utf8')).split(/\r?\n/);assert.ok(!ignored.includes('all-stars/'),'An unanchored legacy directory exclusion would remove public/all-stars from Vercel');assert.ok(ignored.includes('/all-stars/'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
