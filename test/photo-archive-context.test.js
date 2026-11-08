import test from 'node:test';
import assert from 'node:assert/strict';
import {withMatchJerseys,resolveJerseyTeam} from '../photo-archive/jersey-context.mjs';
import {suggestPlayers} from '../photo-archive/matcher.mjs';
import {normalizeLineup} from '../photo-archive/lineup.mjs';
import {validateObservations} from '../photo-archive/vision.mjs';
import {initialSelection,thumbnailState} from '../public/photo-archive/review-model.js';
const teams=withMatchJerseys([{teamId:'red',name:'Traverza'},{teamId:'white',name:'Vikings'}],{homeJerseyColor:'#f00',awayJerseyColor:'#ffffff'});
const players=[{playerId:'odrazil',teamId:'red',jerseyNumber:'19',role:'skater'},{playerId:'zajicek',teamId:'white',jerseyNumber:'19',role:'skater'},
 {playerId:'bezunk',teamId:'white',jerseyNumber:'70',role:'skater'},{playerId:'goalie',teamId:'white',jerseyNumber:'1',role:'goalie'},{playerId:'field',teamId:'white',jerseyNumber:'1',role:'skater'}];
const observation={observedNumber:'19',jerseyNumber:'19',confidence:.99,jerseyColor:'white',jerseyColorConfidence:.96,role:'skater',roleConfidence:.97};
test('match jersey colours disambiguate identical numbers using explicit HMS game colours',()=>{
  assert.equal(teams[0].jerseyFamily,'red');assert.equal(resolveJerseyTeam(observation,teams),'white');
  assert.deepEqual(suggestPlayers(players,[observation],teams)[0].candidates.map(p=>p.playerId),['zajicek']);
  assert.deepEqual(suggestPlayers(players,[{...observation,jerseyColor:'red'}],teams)[0].candidates.map(p=>p.playerId),['odrazil']);
});
test('missing, same or uncertain colour context cannot manufacture a team',()=>{
  for(const context of [[],teams.map(t=>({...t,jerseySource:null})),teams.map(t=>({...t,jerseyFamily:'white'}))])assert.equal(resolveJerseyTeam(observation,context),null);
  assert.equal(resolveJerseyTeam({...observation,jerseyColorConfidence:.5},teams),null);
  assert.equal(resolveJerseyTeam({...observation,jerseyColorConfidence:undefined},teams),null);
});
test('visible goalie equipment restricts candidates to verified goalies; unknown numbers never invent identities',()=>{
  const goalie={...observation,jerseyNumber:null,observedNumber:null,role:'goalie',roleConfidence:.97};
  const result=suggestPlayers(players,[goalie],teams)[0];assert.deepEqual(result.candidates.map(p=>p.playerId),['goalie']);assert.equal(result.tentative,true);
  assert.equal(suggestPlayers(players,[{...goalie,roleConfidence:.4}],teams)[0].candidates.length,0);
  assert.deepEqual(suggestPlayers(players,[{...observation,jerseyNumber:'1',observedNumber:'1'}],teams)[0].candidates.map(p=>p.playerId),['field']);
});
test('78 percent number is visible as a tentative selectable candidate but never preselected',()=>{
  const result=suggestPlayers(players,[{...observation,jerseyNumber:null,observedNumber:'70',confidence:.78}],teams)[0];
  assert.equal(result.tentative,true);assert.equal(result.candidates[0].playerId,'bezunk');assert.deepEqual(initialSelection({suggestions:[result]},null),[]);
});
test('roster roles come from HMS positions or non-deleted goalie events',()=>{
  const data=normalizeLineup('g',{gameId:'g',homeTeamId:'red',awayTeamId:'white',GameEventSaves:[{savedByPlayerId:'g2'}]},[
    {teamId:'white',playerId:'g1',ListPosition:{isGoalie:true}},{teamId:'white',playerId:'g2'},
    {teamId:'red',playerId:'s',ListPosition:{isGoalie:false}},{teamId:'red',playerId:'u'}]);
  assert.deepEqual(data.players.map(p=>p.role),['goalie','goalie','skater','unknown']);
});
test('proposal selection deduplicates safe unique candidates and preserves human drafts and closed selections',()=>{
  const proposal={candidates:[players[0]],tentative:false},photo={suggestions:[proposal,proposal,{candidates:players.slice(0,2)}]};
  assert.deepEqual(initialSelection(photo),['odrazil']);assert.deepEqual(initialSelection(photo,{status:'in_progress',players:[]}),[]);
  assert.deepEqual(initialSelection(photo,{status:'confirmed',players:[players[1]]}),['zajicek']);
  assert.match(thumbnailState(photo,{status:'confirmed',players:players.slice(0,2)}),/Schváleno: 2.*uzavřeno/);
  assert.match(thumbnailState(photo,{status:'in_progress',players:[players[0]]}),/rozpracováno/);
});
test('vision validation rejects invented colour/role enums and retains separate confidence values',()=>{
  const base={jerseyNumber:'70',confidence:.78,evidence:'White jersey',jerseyDescription:'white body',jerseyColor:'white',jerseyColorConfidence:.96,role:'skater',roleConfidence:.98};
  const [o]=validateObservations({observations:[{...base,teamId:'red'}]});assert.equal(o.teamId,null);assert.equal(o.jerseyColor,'white');assert.equal(o.jerseyNumber,null);
  for(const patch of [{jerseyColor:'Vikings'},{role:'captain'},{roleConfidence:2}])assert.throws(()=>validateObservations({observations:[{...base,...patch}]}));
});
