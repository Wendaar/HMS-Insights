import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestPlayers} from './matcher.mjs';

const players=[
  {playerId:'a',teamId:'home',jerseyNumber:'88'},
  {playerId:'b',teamId:'away',jerseyNumber:'88'},
  {playerId:'c',teamId:'home',jerseyNumber:'17'}
];

test('same jersey on two teams stays ambiguous',()=>{
  const [result]=suggestPlayers(players,[{jerseyNumber:'88'}]);
  assert.equal(result.status,'review');
  assert.equal(result.candidates.length,2);
});
test('explicit team gives one candidate but still requires human review',()=>{
  const [result]=suggestPlayers(players,[{jerseyNumber:'88',teamId:'home'}]);
  assert.equal(result.status,'review');
  assert.equal(result.candidates[0].playerId,'a');
});
test('unreadable or absent jersey is not assigned',()=>{
  assert.equal(suggestPlayers(players,[{jerseyNumber:'?' }])[0].status,'unassigned');
});
test('unknown jersey is not assigned',()=>{
  assert.equal(suggestPlayers(players,[{jerseyNumber:'99',teamId:'home'}])[0].reason,'not_on_lineup');
});
test('multiple observations on same photo do not collapse',()=>{
  const results=suggestPlayers(players,[{jerseyNumber:'17',teamId:'home'},{jerseyNumber:'88',teamId:'away'}]);
  assert.deepEqual(results.map(r=>r.candidates[0].playerId),['c','b']);
});
