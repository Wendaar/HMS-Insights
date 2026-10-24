import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeReportPortraits} from '../public/game-report-portraits.js';
import {portrait} from '../src/web/game-report-showcase.js';
const id='11111111-1111-4111-8111-111111111111',url='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_shared_cropped_md';
test('one safe public portrait reaches roster, timeline, assistants and player-card source data',()=>{
  const summary={players:[{id,imageUrl:null}],goalies:[],timeline:{events:[{player:{id:id.toUpperCase()},allowedBy:{id:'other'},assists:[{id}]}]}};
  assert.deepEqual(mergeReportPortraits(summary,{[id]:url,outsider:url}),{[id]:url});
  assert.equal(summary.players[0].imageUrl,url);
  assert.equal(summary.timeline.events[0].player.imageUrl,url);
  assert.equal(summary.timeline.events[0].assists[0].imageUrl,url);
  assert.equal(summary.timeline.events[0].allowedBy.imageUrl,undefined);
  mergeReportPortraits(summary,{[id]:'https://evil.example/private'});
  assert.equal(summary.players[0].imageUrl,url);
});
test('goalie portrait reserves a separate identity area and keeps initials when HMS has no image',()=>{
  const markup=portrait({id,name:'Ryder Gregga'},{goalie:true});
  assert.match(markup,/portrait-goalie/);assert.match(markup,/data-player-portrait/);assert.match(markup,/RG/);assert.doesNotMatch(markup,/<img/);
  assert.match(portrait({id,name:'Keeper',imageUrl:url},{goalie:true}),/<img src=/);
});
