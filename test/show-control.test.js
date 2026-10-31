import test from 'node:test';
import assert from 'node:assert/strict';
import {showControlFeed,spokenClock} from '../src/domain/show-control.js';
import {cues,adCues,cueChannel,reconcile,profileKeys,ledgerKey} from '../public/show-control/model.js';
import {ShowAudio} from '../public/show-control/audio.js';
const detail={gameId:'game',HomeTeam:{teamId:'home',name:'Domácí'},AwayTeam:{teamId:'away',name:'Hosté'}};
const goal={eventId:'GOAL-1',scoredByTeamId:'home',scoredByPlayerId:'p1',ScoredByPlayer:{playerId:'p1',firstName:'Jan',lastName:'Novák',email:'private@example.test'},period:1,gameTime:'03:12'};
const feed=(goals=[goal])=>showControlFeed(detail,{gameId:'game',GameEventGoals:goals,GameEventPenalties:[]});
test('LIVE announcements use stable IDs, sporting fields, and never stale embedded collections',()=>{
  const data=feed([goal,{...goal}]);assert.equal(data.events.length,1);assert.equal(data.events[0].id,'goal:goal-1');assert.match(data.events[0].text,/Jan Novák/);assert.doesNotMatch(JSON.stringify(data),/private|email/);
  assert.equal(showControlFeed({...detail,GameEventGoals:[goal]},null),null);
  assert.equal(showControlFeed(detail,{gameId:'other',GameEventGoals:[goal]}),null);
  assert.equal(feed([{...goal,eventId:undefined},{...goal,eventId:'foreign-team',scoredByTeamId:'foreign'},{...goal,eventId:'foreign-game',gameId:'other'}]).omitted,3);
  assert.throws(()=>feed([goal,{...goal,gameTime:'04:10'}]),/konfliktní/);
  assert.deepEqual(feed([{...goal,isDeleted:true}]).events,[]);
});
test('partial collection coverage is explicit and lineup cannot give names from another side',()=>{
  const data=showControlFeed(detail,{GameEventPenalties:[{eventId:'penalty',penalizedTeamId:'away',penalizedPlayerId:'p2',PenalizedPlayer:{playerId:'wrong',firstName:'Wrong'}}]},[{id:'p2',name:'Foreign',side:'home'}]);
  assert.deepEqual(data.types,['penalty','final','stars']);assert.equal(data.events[0].text,'Vyloučen hráč týmu Hosté.');
});
test('both sides have every requested cue and ads keep stable asset IDs after reordering',()=>{
  assert.equal(cues.length,12);for(const kind of ['pregame','puckdrop','goal','powerplay','ingame','victory'])for(const side of ['HOME','AWAY'])assert.ok(cues.some(c=>c[3]===kind&&c[2]===side));
  const a=adCues([{id:'a',name:'Partner A'},{id:'b',name:'Partner B'}]);const b=adCues([{id:'b',name:'Renamed partner'}]);assert.equal(a[1][3],b[0][3]);assert.equal(b[0][1],'AD 1');assert.equal(cueChannel('puckdrop'),'effect');assert.equal(cueChannel('pregame'),'bed');assert.equal(cueChannel('ad:a'),'effect');
});
test('rich goal includes clock, jersey numbers, assists and independently verified running score',()=>{
  const g={...goal,gameTime:'05:41',assistedBy1PlayerId:'p2',assistedBy2PlayerId:'p3'};
  const roster=[{id:'p1',name:'Michal Honc',side:'home',number:8},{id:'p2',name:'Martin Murárik',side:'home',number:15},{id:'p3',name:'Jaroslav Beneš',side:'home',number:20}];
  const match={coverage:'matches-score',ordered:true,goals:[{id:goal.eventId,scoreAfter:{home:4,away:3}}]};
  const data=showControlFeed(detail,{GameEventGoals:[g]},roster,{match});const text=data.events[0].text;
  assert.match(text,/Čas nula pět čtyřicet jedna/);assert.match(text,/Čtvrtou branku/);assert.match(text,/číslo osm Michal Honc/);assert.match(text,/číslo patnáct Martin Murárik a číslo dvacet Jaroslav Beneš/);assert.match(text,/čtyři ku tři/);
  const unsafe=showControlFeed(detail,{GameEventGoals:[g]},roster,{match:{...match,coverage:'score-mismatch'}}).events[0].text;assert.doesNotMatch(unsafe,/Čtvrtou|Stav utkání/);assert.equal(spokenClock('garbage'),'');
});
test('same-clock penalties across both sides form one announcement; corrections retain identity evidence',()=>{
  const penalty=(id,side)=>({eventId:id,penalizedTeamId:side,period:1,gameTime:'13:15',ListPenaltyType:{name:'Minor'},ListPenaltySubtype:{name:side==='home'?'Roughing':'Cross-checking'}});
  const both=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home'),penalty('p2','away')]}).events;
  assert.equal(both.length,1);assert.equal(both[0].members.length,2);assert.match(both[0].text,/Současně/);assert.match(both[0].text,/menší trest, hrubost/);assert.match(both[0].text,/menší trest, krosček/);
  const single=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home')]}).events.map(e=>({...e,status:'Done'}));
  const updated=reconcile(single,both,['penalty']);assert.equal(updated[0].edited,true);assert.equal(updated[0].status,'New');
  updated[0].status='Done';const split=reconcile(updated,single,['penalty']);assert.equal(split[0].status,'New');assert.equal(split[0].edited,true);
  const different=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home'),{...penalty('p2','away'),gameTime:'13:16'}]}).events;assert.equal(different.length,2);
});
test('final result and official stars require finished status and exact team/roster binding',()=>{
  const game={...detail,status:'FINISHED',HomeTeamGoals:6,AwayTeamGoals:4,GameStars:[{playerId:'p1',teamId:'home'},{playerId:'p1',teamId:'home'},{playerId:'foreign',teamId:'away'}]};
  const roster=[{id:'p1',side:'home',name:'Michal Povolný',number:35,goalie:true}];
  const data=showControlFeed(game,{GameEventGoals:[]},roster);assert.match(data.events.find(e=>e.type==='final').text,/šest ku čtyři/);const star=data.events.find(e=>e.type==='stars').text;assert.match(star,/číslo třicet pět Michal Povolný, brankář/);assert.equal(star.match(/Michal Povolný/g).length,1);assert.doesNotMatch(star,/foreign/);
  assert.equal(showControlFeed({...game,status:'RUNNING'},{GameEventGoals:[]},roster).events.length,0);
  assert.equal(showControlFeed({...game,HomeTeamGoals:null},{GameEventGoals:[]},roster).events.length,0);
  const {GameStars,...withoutStars}=game;assert.equal(showControlFeed(withoutStars,{GameEventGoals:[]},roster,{metadata:{...game,gameId:'foreign'}}).events.some(e=>e.type==='stars'),false);
  assert.equal(showControlFeed({...game,GameStars:[{playerId:'p1',teamId:'away'}]},{GameEventGoals:[]},roster).events.some(e=>e.type==='stars'),false);
});
test('duplicate snapshots keep Done; edits reset status; deleted events stay skipped when restored',()=>{
  const original=feed().events;let rows=reconcile([],original,['goal']);rows[0].status='Done';
  rows=reconcile(rows,original,['goal']);assert.equal(rows.length,1);assert.equal(rows[0].status,'Done');
  rows=reconcile(rows,[{...original[0],text:'Opravený střelec.'}],['goal']);assert.equal(rows[0].status,'New');assert.equal(rows[0].edited,true);
  rows=reconcile(rows,[],['penalty']);assert.equal(rows[0].withdrawn,false);
  rows=reconcile(rows,[],['goal']);assert.equal(rows[0].withdrawn,true);assert.equal(rows[0].status,'Skipped');
  rows=reconcile(rows,[{...original[0],text:'Opravený střelec.'}],['goal']);assert.equal(rows[0].status,'Skipped');
  assert.throws(()=>reconcile([],original.concat(original),['goal']),/duplicitní/);
});
test('profiles and ledgers isolate organization, team, match and test/live namespaces',()=>{
  assert.deepEqual(profileKeys('PHM','HOME','goal'),['show:v1:PHM:team:home:goal','show:v1:PHM:organization:goal','show:v1:PHM:default:goal']);
  assert.notEqual(profileKeys('PHM',null,'goal')[0],profileKeys('EUCHL',null,'goal')[0]);
  assert.notEqual(ledgerKey('PHM','g','test'),ledgerKey('PHM','g','live'));assert.notEqual(ledgerKey('PHM','g','live'),ledgerKey('EUCHL','g','live'));
});
function audioHarness(){
  const spoken=[],tracks=[];class FakeAudio{constructor(){tracks.push(this);}async play(){this.paused=false;}pause(){this.paused=true;}removeAttribute(){}load(){}}
  const synth={cancel(){},pause(){},resume(){},speak(u){spoken.push(u);}};
  return {audio:new ShowAudio({synth,AudioClass:FakeAudio,Utterance:class{constructor(text){this.text=text;}}}),spoken,tracks};
}
test('speech ducks both channels and STOP cancels callbacks without marking an event Done',async()=>{
  const {audio,spoken,tracks}=audioHarness(),states=[];
  await audio.play(new Blob(['own audio']),'bed',{loop:true});await audio.play(new Blob(['own effect']),'effect');
  audio.speak('Gól',null,status=>states.push(status));assert.equal(tracks[0].volume,audio.volume*audio.duck);
  assert.equal(tracks[1].volume,audio.volume*audio.duck);
  const stale=spoken[0];audio.stop();assert.deepEqual(states,['New']);stale.onend();assert.deepEqual(states,['New']);assert.equal(audio.speaking,false);assert.deepEqual(audio.tracks,{});assert.ok(tracks.every(t=>t.paused));
});
test('natural completion marks Done and restores volume; replacing tracks leaves a single bed',async()=>{
  const {audio,spoken,tracks}=audioHarness(),states=[];
  await audio.play(new Blob(['mix']),'bed');audio.speak('Gól',null,s=>states.push(s));spoken[0].onend();assert.deepEqual(states,['Done']);assert.equal(tracks[0].volume,.8);
  await audio.play(new Blob(['mix2']),'bed');assert.equal(tracks[0].paused,true);assert.equal(Object.keys(audio.tracks).length,1);audio.stop();
});
