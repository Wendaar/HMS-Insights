import test from 'node:test';
import assert from 'node:assert/strict';
import {showControlFeed} from '../src/domain/show-control.js';
import {reconcile,profileKeys,ledgerKey} from '../public/show-control/model.js';
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
  assert.deepEqual(data.types,['penalty']);assert.equal(data.events[0].text,'Vyloučení týmu Hosté.');
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
