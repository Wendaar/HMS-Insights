import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveInsightSubject,insightStat,brandingScope} from '../public/studio/subjects.js';
import {safeArea,imageSources} from '../public/studio/graphics.js';
import {loadStudioInsights} from '../src/infrastructure/postgres-repository.js';
import {browseMedia,applyPublicMedia} from '../src/app/media-engine.js';
const gameId='f6293ef1-98ca-11f1-8bdf-ef2495d048f3',playerId='da0ba510-648c-11ef-8a7f-3b932af99033',homeId='8c035c24-5703-4628-9f71-e0b6280196db',awayId='baed154a-5e0f-4c57-bd3e-9a4d02fe7072';
const game={gameId,home:{id:homeId,name:'Domynos',logoUrl:'HOME'},away:{id:awayId,name:'Berkut',logoUrl:'AWAY'},players:[{id:playerId,name:'Matěj Kuracina',teamId:awayId,imageUrl:'PORTRAIT',goals:3,points:3}]};
const insight={id:`${gameId}:HATTRICK:${playerId}`,gameId,playerId,teamId:awayId,player:'Matěj Kuracina',type:'HATTRICK'};
test('away player resolves by ID to Berkut and portrait, never the home fallback',()=>{
 const s=resolveInsightSubject(game,insight);assert.equal(s.teamName,'Berkut');assert.equal(s.teamLogoUrl,'AWAY');assert.equal(s.photoUrl,'PORTRAIT');assert.deepEqual(insightStat(s),{value:3,label:'GÓLY'});
 const images=imageSources(game,insight,{});assert.equal(images.player,'PORTRAIT');assert.equal(images.subjectTeam,'AWAY');
 const noPhoto={...game,players:[{...game.players[0],imageUrl:null}]};assert.equal(imageSources(noPhoto,insight,{}).player,null);assert.equal(imageSources(noPhoto,insight,{}).subjectTeam,'AWAY');
});
test('wrong feed team cannot overwrite game roster and another game cannot reuse a subject',()=>{
 assert.equal(resolveInsightSubject(game,{...insight,teamId:homeId,teamLogoUrl:'WRONG'}).teamName,'Berkut');
 assert.equal(resolveInsightSubject(game,{...insight,gameId:homeId}),null);
 const unknown=resolveInsightSubject({...game,players:[]},{...insight,playerId:homeId,teamId:null});assert.equal(unknown.teamLogoUrl,null);assert.equal(unknown.identityAvailable,false);
});
test('safe area leaves story UI margins and square content padding',()=>{
 assert.deepEqual(safeArea('9:16'),{x:96,y:220,w:864,h:1360});assert.deepEqual(safeArea('1:1'),{x:64,y:64,w:952,h:952});
 assert.ok(safeArea('9:16').y+safeArea('9:16').h<=1920-320);
});
test('Insights is searchable across past games, org-scoped, limited and parameterized',async()=>{
 let call;
 const result=await loadStudioInsights({organizationId:homeId,today:'2026-10-21',query:"Matěj %_' OR 1=1 --",type:'HATTRICK',offset:20,limit:20,sql:{query:async(text,values)=>{call={text,values};return [];}}});
 assert.equal(result.hasMore,false);assert.match(call.text,/g.organization_id=\$1::uuid/);assert.match(call.text,/g.played_on <= \$2::date/);assert.doesNotMatch(call.text,/OR 1=1/);
 assert.match(call.text,/coalesce\(ps.team_id,gs.team_id,f.team_id\)/);assert.deepEqual(call.values.slice(-2),[21,20]);assert.ok(call.values[2].includes('matej'));assert.ok(call.values[2].includes('\\%'));assert.equal(call.values[3],'HATTRICK');
});
test('Insights bypasses calendar filters, passes search/type and exposes safe context/subject IDs',async()=>{
 let params;
 const page=await browseMedia({org:'PHM',section:'insights',filter:'Future',query:'Kuracina',type:'HATTRICK'}, {env:{},now:new Date('2026-10-21T12:00Z'),loadInsights:async p=>{params=p;return {items:[{...insight,title:'Hattrick',text:'3 góly',team:'Berkut',homeTeam:'Domynos',awayTeam:'Berkut',homeScore:1,awayScore:4,facts:{goals:3,private:'hidden'},email:'hidden'}],hasMore:false};}});
 assert.equal(params.query,'Kuracina');assert.equal(params.today,'2026-10-21');assert.equal(params.from,undefined);assert.equal(page.items[0].teamId,awayId);assert.equal(page.items[0].homeTeam,'Domynos');assert.deepEqual(page.items[0].stats,{goals:3});assert.equal(page.items[0].email,undefined);
});
test('public media uses matching player+team IDs and separate competition/group brands',()=>{
 const url='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/photo_[size]';
 const summary={...game,playedOn:'2026-10-20',competition:'PHM Cup',group:'SUPER',phase:'Základní část',home:{...game.home,logoUrl:null},away:{...game.away,logoUrl:null},players:[{...game.players[0],imageUrl:null}]};
 const meta={startDate:summary.playedOn,HomeTeam:{teamId:homeId},AwayTeam:{teamId:awayId},Phase:{name:summary.phase,Group:{name:'SUPER',logoUrl:url,Season:{Competition:{name:'PHM Cup',logoUrl:url}}}},Lineups:[{teamId:homeId,Player:{playerId,logoUrl:url}}]};
 applyPublicMedia(summary,meta);assert.equal(summary.players[0].imageUrl,null);assert.match(summary.competitionLogoUrl,/cropped_md$/);assert.match(summary.groupLogoUrl,/cropped_md$/);
 applyPublicMedia(summary,{...meta,Lineups:[{teamId:awayId,Player:{playerId,logoUrl:url}}]});assert.match(summary.players[0].imageUrl,/cropped_md$/);
});

test('local branding scopes separate orgs, competitions and groups',()=>{
 assert.notEqual(brandingScope('PHM',{competition:'Cup',group:'A'},'groupLogo'),brandingScope('PHM',{competition:'Cup',group:'B'},'groupLogo'));
 assert.notEqual(brandingScope('PHM',{competition:'Cup'},'competitionLogo'),brandingScope('EUCHL',{competition:'Cup'},'competitionLogo'));
 assert.equal(brandingScope('PHM',{competition:'Cup',group:'A'},'competitionLogo'),brandingScope('PHM',{competition:'Cup',group:'B'},'competitionLogo'));
});
