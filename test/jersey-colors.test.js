import test from 'node:test';
import assert from 'node:assert/strict';
import {jerseyColor,teamPalette,rinkSvg,colorOutline} from '../public/game-report-graphics.js';
import {normalizeHmsGame} from '../src/hms/normalize.js';
import {buildGameSummary} from '../src/domain/game-summary.js';
import {rowsFor} from '../src/infrastructure/analysis-rows.js';
import {sampleAnalysis} from '../src/app/sample.js';
import {gameEvents,lineup} from '../src/fixtures/zbraslav-kosti.js';
test('explicit white versus blue match jerseys survive normalization and public summary',()=>{
  const g=normalizeHmsGame({...gameEvents,homeJerseyColor:'#FFF',awayJerseyColor:'#304bb2'},lineup);
  assert.deepEqual(g.eventSnapshot.jerseyColors,{home:'#ffffff',away:'#304bb2'});
  const r=rowsFor(sampleAnalysis),s=buildGameSummary({game:{...r.games[0],event_snapshot:{...r.games[0].event_snapshot,jerseyColors:g.eventSnapshot.jerseyColors}},teams:r.team_game_stats});
  assert.equal(s.home.jerseyColor,'#ffffff');assert.equal(s.away.jerseyColor,'#304bb2');
  assert.deepEqual(Object.values(teamPalette(s)),['#ffffff','#304bb2']);
});
test('white goal pins have a dark outline and dark number; white is never recolored',()=>{
  const s={home:{id:'h',jerseyColor:'#ffffff',color:'#2222aa'},away:{id:'a',jerseyColor:'#2222aa'},timeline:{events:[{id:'g',type:'goal',teamId:'h',player:{name:'Player'},details:{shotZone:{code:'left-circle'}}}]}};
  const svg=rinkSvg(s,s.timeline.events);assert.match(svg,/fill="#ffffff" stroke="#536779"/);assert.match(svg,/fill="#102133"/);assert.equal(colorOutline('#ffffff'),'#536779');
});
test('similar club colors get distinct fallbacks but explicit jerseys remain authoritative',()=>{
  const s={home:{id:'h',color:'#3121b3'},away:{id:'a',color:'#304bb2'}};
  assert.notEqual(teamPalette(s).a,'#304bb2');
  s.away.jerseyColor='#304bb2';assert.equal(teamPalette(s).a,'#304bb2');assert.notEqual(teamPalette(s).h,'#3121b3');
  s.home.jerseyColor='#304bb2';assert.deepEqual(teamPalette(s),{h:'#304bb2',a:'#304bb2'});
});
test('missing jersey is unknown and arbitrary CSS cannot enter stored or public colors',()=>{
  for(const value of [null,'','white','url(https://evil.example)','red" onload="x'])assert.equal(jerseyColor(value),null);
  const g=normalizeHmsGame(gameEvents,lineup);assert.deepEqual(g.eventSnapshot.jerseyColors,{home:null,away:null});
});
