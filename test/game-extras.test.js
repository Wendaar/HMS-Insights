import test from 'node:test';
import assert from 'node:assert/strict';
import {displayExtras,getGameExtras} from '../src/app/game-extras.js';
import {createGameExtrasHandler} from '../src/web/game-extras-handler.js';
import {youtubeVideo} from '../public/game-report-media.js';
import {sampleAnalysis} from '../src/app/sample.js';
import {rowsFor} from '../src/infrastructure/analysis-rows.js';
const r=rowsFor(sampleAnalysis),snapshot={game:r.games[0],teams:r.team_game_stats,players:r.player_game_stats,goalies:r.goalie_game_stats};
const game={gameId:snapshot.game.game_id,HomeTeam:{teamId:snapshot.game.home_team_id},AwayTeam:{teamId:snapshot.game.away_team_id},Lineups:[...snapshot.players.map(p=>({teamId:p.team_id,Player:{playerId:p.player_id},ListPosition:{isGoalie:false}})),...snapshot.goalies.map(p=>({teamId:p.team_id,Player:{playerId:p.player_id},ListPosition:{isGoalie:true}}))]};
test('official stars retain arbitrary counts, goalie role and game stats, deduplicate and ignore deletion',()=>{
  const stars=game.Lineups.map(p=>({...p,email:'PRIVATE'}));
  const data=displayExtras(snapshot,{...game,GameStars:[...stars,stars[0],{...stars[0],isDeleted:true}]},null,[]);
  assert.equal(data.stars.length,stars.length);assert.ok(data.stars.length>3);
  assert.equal(data.stars[0].goals,snapshot.players[0].goals);assert.ok(data.stars.some(s=>s.role==='goalie'));
  assert.doesNotMatch(JSON.stringify(data),/email|PRIVATE|ListPosition|GameStars/);
});
test('wrong games, wrong teams and players outside the lineup cannot supply stars or roster counts',()=>{
  assert.equal(displayExtras(snapshot,{...game,gameId:'other',GameStars:game.Lineups},null,[]).stars.length,0);
  assert.deepEqual(displayExtras(snapshot,{...game,HomeTeam:{teamId:'other'}},null,[]).rosterCounts,{});
  assert.equal(displayExtras(snapshot,{...game,GameStars:[{teamId:'other',Player:game.Lineups[0].Player}]},null,[]).stars.length,0);
});
test('public response without gameId requires matching teams, date and final score',()=>{
  const {gameId,...publicGame}=game;Object.assign(publicGame,{startDate:snapshot.game.played_on,HomeTeamGoals:snapshot.game.home_score,AwayTeamGoals:snapshot.game.away_score,GameStars:game.Lineups});
  assert.equal(displayExtras(snapshot,publicGame,null,[]).stars.length,game.Lineups.length);
  assert.equal(displayExtras(snapshot,{...publicGame,startDate:'1900-01-01'},null,[]).stars.length,0);
  assert.equal(displayExtras(snapshot,{...publicGame,HomeTeamGoals:999},null,[]).stars.length,0);
});
test('roster counts include a non-playing goalie; missing game stats do not become fabricated zeroes',()=>{
  const id='11111111-1111-4111-8111-111111111111',teamId=game.HomeTeam.teamId;
  const bench={teamId,Player:{playerId:id,firstName:'Bench',lastName:'Goalie'},ListPosition:{isGoalie:true}};
  const data=displayExtras(snapshot,{...game,Lineups:[...game.Lineups,bench],GameStars:[bench]},null,[]);
  assert.equal(data.rosterCounts[teamId.toLowerCase()].goalies,snapshot.goalies.filter(k=>k.team_id.toLowerCase()===teamId.toLowerCase()).length+1);
  assert.equal(data.stars[0].hasCard,false);assert.equal(data.stars[0].saves,undefined);
});
test('current group rankings and safe YouTube links are returned independently of missing stars',()=>{
  const p=snapshot.players[0],data=displayExtras(snapshot,game,{youtubeVideoUrl:'https://youtu.be/irlKbr4YhbE'},[{PlayerId:p.player_id,G:5,A:6}]);
  assert.equal(data.ranks[p.player_id.toLowerCase()],1);assert.equal(data.media.youtubeUrl,'https://www.youtube.com/watch?v=irlKbr4YhbE');
  for(const value of ['javascript:alert(1)','https://youtube.com.evil.example/watch?v=irlKbr4YhbE','https://secret@youtube.com/watch?v=irlKbr4YhbE','https://www.youtube.com/watch?v=bad'])assert.equal(youtubeVideo(value),null);
});
test('extras uses only fixed public sporting endpoints, no credentials, and tolerates outages',async()=>{
  let calls=0;
  const data=await getGameExtras(game.gameId,{loadSnapshot:async()=>snapshot,fetchImpl:async(url,init)=>{
    calls++;assert.equal(new URL(url).hostname,'api.prod.hms.wootera.net');assert.equal(init.headers.authorization,undefined);
    return {ok:true,json:async()=>url.includes('playersStats')?[]:url.includes('gameMultimedia')?{}:{...game,GameStars:game.Lineups}};
  }});
  assert.equal(calls,3);assert.equal(data.stars.length,game.Lineups.length);
  const failed=await getGameExtras(game.gameId,{loadSnapshot:async()=>snapshot,fetchImpl:async()=>{throw Error('offline');}});assert.deepEqual(failed.stars,[]);
});
test('extras handler validates IDs, is read-only and hides internal failures',async()=>{
  const response=()=>({setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;}});
  for(const [req,status] of [[{method:'POST',query:{gameId:game.gameId}},405],[{method:'GET',query:{gameId:'bad'}},400]]){const res=response();await createGameExtrasHandler({loadExtras:async()=>assert.fail()})(req,res);assert.equal(res.code,status);}
  const res=response();await createGameExtrasHandler({loadExtras:async()=>{throw Error('SECRET');}})({method:'GET',query:{gameId:game.gameId}},res);assert.equal(res.code,503);assert.doesNotMatch(JSON.stringify(res.body),/SECRET/);
});
