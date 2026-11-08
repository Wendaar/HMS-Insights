import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLineup,fetchLineup} from './lineup.mjs';
const detail={gameId:'game',homeTeamId:'home',awayTeamId:'away'};
const row={gameId:'game',teamId:'home',number:0,Player:{playerId:'p',firstName:'Test',lastName:'Player'}};
test('lineup adapter preserves zero, names, nested IDs and removes deleted rows',()=>{
  const data=normalizeLineup('GAME',detail,{gameId:'game',Lineups:[row,{...row,isDeleted:true}]});
  assert.deepEqual(data.players,[{playerId:'p',teamId:'home',jerseyNumber:'0',name:'Test Player',role:'unknown'}]);
});
test('rejects wrong game, row game, team, identity conflicts and empty/unknown shape',()=>{
  assert.throws(()=>normalizeLineup('wrong',detail,[row]),/identity/);
  assert.throws(()=>normalizeLineup('game',detail,{gameId:'wrong',Lineups:[row]}),/different game/);
  for(const bad of [{...row,gameId:'wrong'},{...row,teamId:'wrong'},{...row,playerId:'conflict'}]) assert.throws(()=>normalizeLineup('game',detail,[bad]));
  assert.throws(()=>normalizeLineup('game',detail,{}),/Lineups/);
  assert.throws(()=>normalizeLineup('game',detail,[]),/no usable/);
});
test('HMS only calls GET /game and /gameLineup with redirects disabled',async()=>{
  const paths=[];
  await fetchLineup('game',{env:{HMS_API_TOKEN:'fake'},fetchImpl:async(url,init)=>{
    assert.equal(init.method || 'GET','GET');assert.equal(init.redirect,'error');
    assert.equal(init.headers.authorization,'Bearer fake');assert.equal(url.searchParams.get('gameId'),'game');paths.push(url.pathname);
    return Response.json(url.pathname.endsWith('/game')?detail:{gameId:'game',Lineups:[row]});
  }});
  assert.deepEqual(paths.sort(),['/api/v1/game','/api/v1/gameLineup']);
});
