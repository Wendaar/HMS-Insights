import test from 'node:test';
import assert from 'node:assert/strict';
import {showControlFeed,spokenClock} from '../src/domain/show-control.js';
import {cues,adCues,cueChannel,reconcile,profileKeys,ledgerKey,signature,finishAnnouncement,sponsorAds} from '../public/show-control/model.js';
import {ShowAudio} from '../public/show-control/audio.js';
import {spokenText,pronunciationRules,speechParts} from '../public/show-control/speech.js';
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
  assert.match(text,/Čas nula pět čtyřicet jedna/);assert.match(text,/Čtvrtou branku/);assert.match(text,/číslo osm, Michal Honc/);assert.match(text,/číslo patnáct, Martin Murárik; a číslo dvacet, Jaroslav Beneš/);assert.match(text,/čtyři tři/);
  const unsafe=showControlFeed(detail,{GameEventGoals:[g]},roster,{match:{...match,coverage:'score-mismatch'}}).events[0].text;assert.doesNotMatch(unsafe,/Čtvrtou|Stav utkání/);assert.equal(spokenClock('garbage'),'');
});
test('same-clock penalties across both sides form one announcement; corrections retain identity evidence',()=>{
  const penalty=(id,side)=>({eventId:id,penalizedTeamId:side,period:1,gameTime:'13:15',ListPenaltyType:{name:'Minor'},ListPenaltySubtype:{name:side==='home'?'Roughing':'Cross-checking'}});
  const both=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home'),penalty('p2','away')]}).events;
  assert.equal(both.length,1);assert.equal(both[0].members.length,2);assert.match(both[0].text,/Současně/);assert.match(both[0].text,/menší trest; hrubost/);assert.match(both[0].text,/menší trest; krosček/);
  const single=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home')]}).events.map(e=>({...e,status:'Done'}));
  const updated=reconcile(single,both,['penalty']);assert.equal(updated[0].edited,true);assert.equal(updated[0].status,'New');
  updated[0].status='Done';const split=reconcile(updated,single,['penalty']);assert.equal(split[0].status,'New');assert.equal(split[0].edited,true);
  const different=showControlFeed(detail,{GameEventPenalties:[penalty('p1','home'),{...penalty('p2','away'),gameTime:'13:16'}]}).events;assert.equal(different.length,2);
});
test('final result and official stars require finished status and exact team/roster binding',()=>{
  const game={...detail,status:'FINISHED',HomeTeamGoals:6,AwayTeamGoals:4,GameStars:[{playerId:'p1',teamId:'home'},{playerId:'p1',teamId:'home'},{playerId:'foreign',teamId:'away'}]};
  const roster=[{id:'p1',side:'home',name:'Michal Povolný',number:35,goalie:true}];
  const data=showControlFeed(game,{GameEventGoals:[]},roster);assert.match(data.events.find(e=>e.type==='final').text,/šest čtyři/);const star=data.events.find(e=>e.type==='stars').text;assert.match(star,/číslo třicet pět, Michal Povolný, brankář/);assert.equal(star.match(/Michal Povolný/g).length,1);assert.doesNotMatch(star,/foreign/);
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
  await audio.play(new Blob(['mix']),'bed');audio.speak('Gól',null,s=>states.push(s));spoken[0].onend();assert.deepEqual(states,['Done']);assert.equal(tracks[0].volume,audio.volume);
  await audio.play(new Blob(['mix2']),'bed');assert.equal(tracks[0].paused,true);assert.equal(Object.keys(audio.tracks).length,1);audio.stop();
});
test('speech completion/cancellation targets the current event after any number of LIVE reconciliations',()=>{
  const original=feed().events;let rows=reconcile([],original,['goal']),id=rows[0].id,revision=signature(rows[0]);
  rows[0].status='Playing';const old=rows[0];for(let i=0;i<3;i++)rows=reconcile(rows,original,['goal']);assert.notEqual(rows[0],old);
  assert.equal(finishAnnouncement(rows,id,revision,'Done'),true);assert.equal(rows[0].status,'Done');
  rows=reconcile(rows,[{...original[0],text:'Oprava'}],['goal']);assert.equal(finishAnnouncement(rows,id,revision,'Done'),false);assert.equal(rows[0].status,'New');
});
test('voice gain is independent from music and natural completion fires only once',()=>{
  const {audio,spoken}=audioHarness(),states=[];audio.volume=.2;audio.voiceVolume=.9;audio.speak('Hlas',null,s=>states.push(s));assert.equal(spoken[0].volume,.9);assert.equal(audio.utterance,spoken[0]);
  spoken[0].onend();spoken[0].onend();assert.deepEqual(states,['Done']);assert.equal(audio.utterance,null);
});
test('HMS sponsor names stay scoped to the organization and exact returned team links',()=>{
  const id=n=>`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}`;
  const catalog={org:'PHM',items:[{id:id('1'),name:'Organization',active:true},{id:id('2'),name:'Home',scopeRefs:{teamIds:[id('a')]}},{id:id('3'),name:'Away via binding'},{id:id('4'),name:'Other team',teams:[id('c')]}],bindings:[{sponsorId:id('3'),teamId:id('b')}]};
  assert.equal(sponsorAds(catalog,'EUCHL',[]).length,0);assert.equal(sponsorAds(catalog,'PHM',[]).length,4);assert.deepEqual(sponsorAds(catalog,'PHM',[id('a'),id('b')],'teams').map(s=>s.name),['Home','Away via binding']);
  assert.equal(sponsorAds(catalog,'PHM',[],'teams').length,0);assert.equal(sponsorAds(catalog,'PHM',[])[0].id,'hms:'+id('1'));
});
test('Czech pronunciation dictionary changes speech only, with explicit language boundaries',()=>{
  assert.equal(spokenText('PHM Cup. Kyle Poirier.'),'PHM Kap. Kajl Poariér.');
  assert.equal(spokenText('PHM Cup. Kyle Poirier.',undefined,'en'),'PHM Cup. Kyle Poirier.');
  assert.deepEqual(pronunciationRules('Kyle Poirier = Kajl Poariér\nbad line\nA = B'),[['Kyle Poirier','Kajl Poariér'],['A','B']]);
  assert.deepEqual(speechParts('Číslo osm, Michal Honc; menší trest. Sekání.'),['Číslo osm,','Michal Honc;','menší trest.','Sekání.']);
});
test('timed pauses keep music ducked and Playing active until the final segment, respecting pause/resume',async()=>{
  const {audio,spoken}=audioHarness(),states=[];audio.pauseMs=10;audio.speak('Číslo osm, Kyle Poirier. PHM Cup.',null,s=>states.push(s));
  assert.equal(spoken[0].rate,.9);spoken[0].onend();assert.equal(audio.speaking,true);assert.deepEqual(states,[]);
  await new Promise(r=>setTimeout(r,25));assert.equal(spoken[1].text,'Kajl Poariér.');audio.pause();spoken[1].onend();await new Promise(r=>setTimeout(r,25));assert.equal(spoken.length,2);
  await audio.resume();assert.equal(spoken[2].text,'PHM Kap.');spoken[2].onend();assert.deepEqual(states,['Done']);assert.equal(audio.speaking,false);
});
test('STOP during an inter-part pause cancels all remaining speech',async()=>{
  const {audio,spoken}=audioHarness(),states=[];audio.pauseMs=10;audio.speak('Číslo osm, hráč.',null,s=>states.push(s));spoken[0].onend();audio.stop();await new Promise(r=>setTimeout(r,25));assert.equal(spoken.length,1);assert.deepEqual(states,['New']);
});
