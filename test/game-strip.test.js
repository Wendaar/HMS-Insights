import test from 'node:test';
import assert from 'node:assert/strict';
import {stripSelection,readGameStrip} from '../src/app/game-strip.js';
import {stripMedia} from '../src/app/game-strip-media.js';
import {loadStripReports} from '../src/infrastructure/postgres-repository.js';
import {publicSeasonGame} from '../src/domain/season-games.js';
import {newWidget,resolveWidgetContext} from '../public/widgets/definitions.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const season={seasonId:id(10),competitionId:id(11),competition:'Cup',season:'2026'};
const directory={groups:[{id:id(30),name:'Group A',phases:[{id:id(40),name:'Phase'}]}],teams:[{id:id(20),name:'Home',groupIds:[id(30)]},{id:id(21),name:'Away',groupIds:[id(30)]}]};
const game=(date='2026-11-20',n=1)=>({id:id(n),date,time:'15:00',status:'NOT PLAYED',home:{id:id(20),name:'Home',score:null},away:{id:id(21),name:'Away',score:null},group:{id:id(30)},phase:{id:id(40)}});
const options=(extra={})=>({env:{HMS_YHG_ORGANIZATION_ID:id(2)},portalCatalog:async()=>({items:[season]}),portalDirectory:async()=>directory,portalBranding:async()=>null,readSeason:async()=>[game()],stripMedia:async()=>new Map(),readStandings:async()=>[{id:id(20),rank:3,shortName:'HM'},{id:id(21),rank:7}],now:new Date('2026-11-18T12:00Z'),...extra});
test('playing days skip gaps, anchor today/next/last, expose four each side and paginate chronologically',()=>{
 const rows=Array.from({length:12},(_,i)=>game('2026-11-'+String(i*2+1).padStart(2,'0'),i+1));
 const p=stripSelection(rows,{},new Date('2026-11-12T10:00Z'));assert.equal(p.date,'2026-11-13');assert.equal(p.previous,'2026-11-11');assert.equal(p.next,'2026-11-15');assert.equal(p.dates.length,9);
 assert.equal(stripSelection(rows,{},new Date('2026-11-13T10:00Z')).date,'2026-11-13');assert.equal(stripSelection(rows,{},new Date('2026-12-01')).date,'2026-11-23');
 const many=Array.from({length:25},(_,i)=>({...game(undefined,i+1),time:i===0?null:'10:00'}));const page=stripSelection(many,{},new Date('2026-11-18'));assert.equal(page.items.length,20);assert.equal(page.hasMore,true);assert.equal(stripSelection(many,{offset:20},new Date('2026-11-18')).items.at(-1).time,null);
 assert.equal(stripSelection([],{},new Date()).date,null);assert.throws(()=>stripSelection(rows,{date:'2026-11-12'}));assert.throws(()=>stripSelection(rows,{offset:1}));
});
test('calendar anchor honors tournament timezone at midnight and DST',()=>{
 assert.equal(stripSelection([],{},new Date('2026-11-18T23:30Z'),'Europe/Prague').today,'2026-11-19');
 assert.equal(stripSelection([],{},new Date('2026-11-18T23:30Z'),'America/Toronto').today,'2026-11-18');
});
test('new instances default above homepage introduction without migrating existing widget layout',()=>{
 const a=newWidget('game-strip'),b=newWidget('game-strip');assert.notEqual(a.widgetInstanceId,b.widgetInstanceId);assert.equal(a.layout.section,'top');assert.equal(newWidget('leaders').layout.section,'bottom');assert.equal(resolveWidgetContext({phaseId:null},{phaseId:id(40)}).phaseId,null);
});
test('future fixtures need no imports; ranks use their own group, missing scores and report stay absent',async()=>{
 const p=await readGameStrip('yhg',{seasonId:id(10)},options());assert.equal(p.items.length,1);assert.equal(p.items[0].reportUrl,null);assert.equal(p.items[0].home.score,null);assert.equal(p.items[0].home.rank,3);assert.equal(p.items[0].away.rank,7);assert.equal(p.items[0].home.shortName,'HM');
 const absent=await readGameStrip('yhg',{},options({readStandings:async()=>{throw Error('unavailable');}}));assert.equal(absent.items[0].home.rank,null);
});
test('organization, season, group and phase rejected before schedule reads; foreign fixture hierarchy excluded',async()=>{
 let reads=0;const opt=options({readSeason:async()=>{reads++;return [{...game(),group:{id:id(99)}}];}});
 for(const scope of [{organisationId:id(99)},{seasonId:id(99)},{groupId:id(99)},{phaseId:id(99)}])await assert.rejects(()=>readGameStrip('yhg',scope,opt));assert.equal(reads,0);
 assert.equal((await readGameStrip('yhg',{},opt)).items.length,0);
});
test('finished and live zeroes are real, planned zeroes suppressed and missing final goals remain unknown',()=>{
 const raw={gameId:id(1),startDate:'2026-11-20',HomeTeamGoals:0,AwayTeamGoals:null,Phase:{Group:{Season:{seasonId:id(10)}}}};
 for(const status of ['FINISHED','RUNNING','NOT PLAYED','POSTPONED']){const g=publicSeasonGame({...raw,status},id(10),raw.startDate);assert.equal(g.home.score,['FINISHED','RUNNING'].includes(status)?0:null);assert.equal(g.away.score,null);}
});
test('only valid media URLs cross the optional batch; mismatched IDs and unsafe hosts stay hidden',async()=>{
 const context={organization:{id:id(2)},scope:{seasonId:id(10)}};
 const fixtures=[game(undefined,1),game(undefined,2),game(undefined,3)];let active=0,max=0;
 const media=await stripMedia(context,fixtures,{fetchImpl:async url=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;const n=new URL(url).searchParams.get('gameId');return {ok:true,json:async()=>n===id(1)?{youtubeVideoUrl:'https://youtu.be/abcdefghijk',albumUrl:'https://www.flickr.com/photos/test/albums/123'}:n===id(2)?{gameId:id(99),youtubeVideoUrl:'https://youtu.be/abcdefghijk'}:{youtubeVideoUrl:'https://evil.example/watch?v=abcdefghijk',albumUrl:'javascript:alert(1)'}};}});
 assert.equal(media.get(id(1)).youtubeUrl,'https://www.youtube.com/watch?v=abcdefghijk');assert.ok(media.get(id(1)).albumUrl);assert.equal(media.get(id(2)).youtubeUrl,null);assert.equal(media.get(id(3)).albumUrl,null);assert.ok(max<=3);
});
test('reports/photos are loaded by one parameterized organization + season + visible IDs query',async()=>{
 let args;await loadStripReports([id(1)],id(10),id(2),{sql:{query:async(...a)=>{args=a;return [];}}});assert.match(args[0],/organization_id=\$1::uuid and season_id=\$2::uuid/);assert.deepEqual(args[1],[id(2),id(10),[id(1)]]);
 const p=await readGameStrip('yhg',{},options({loadReports:async()=>[{game_id:id(1),album_url:'https://www.flickr.com/photos/test/albums/123'}]}));assert.match(p.items[0].reportUrl,/\/public$/);assert.ok(p.items[0].media.albumUrl);
});
