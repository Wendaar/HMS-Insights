import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichBroadcastLineup,broadcastMatch} from '../src/domain/broadcast-match.js';
import {officialStandings,officialTeamLeaders,broadcastLeague} from '../src/app/broadcast-league.js';
import {standingsExcerpt,renderLeagueLayer} from '../public/broadcast/league-layers.js';
import {renderMatchLayer} from '../public/broadcast/match-layers.js';
import {channelState} from '../src/web/broadcast-channel.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const photo='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_TEST_[size]';
const detail={gameId:id(1),organizationId:id(2),startDate:'2026-10-25',phaseId:id(3),HomeTeam:{teamId:id(4)},AwayTeam:{teamId:id(5)},HomeTeamGoals:2,AwayTeamGoals:0};
const privateLineup={gameId:id(1),Lineups:[{gameId:id(1),teamId:id(4),playerId:id(6),Player:{playerId:id(6),firstName:'Player',lastName:'Home'}}]};
const metadata={startDate:'2026-10-25',HomeTeam:{teamId:id(4)},AwayTeam:{teamId:id(5)},Lineups:[{teamId:id(4),playerId:id(6),Player:{playerId:id(6),firstName:'Player',lastName:'Home',logoUrl:photo}}]};
test('portraits enrich the authenticated lineup only for matching game date, both team IDs and player+team membership',()=>{
  const enriched=enrichBroadcastLineup(detail,privateLineup,metadata);assert.match(enriched.Lineups[0].Player.logoUrl,/cropped_md/);assert.equal(privateLineup.Lineups[0].Player.logoUrl,undefined);
  for(const bad of [{...metadata,startDate:'2026-10-26'},{...metadata,HomeTeam:{teamId:id(99)}},{...metadata,gameId:id(99)}])assert.equal(enrichBroadcastLineup(detail,privateLineup,bad),privateLineup);
  const wrong=enrichBroadcastLineup(detail,privateLineup,{...metadata,Lineups:[{...metadata.Lineups[0],teamId:id(5)}]});assert.equal(wrong.Lineups[0].Player.logoUrl,null);
  const unsafe=enrichBroadcastLineup(detail,privateLineup,{...metadata,Lineups:[{...metadata.Lineups[0],Player:{...metadata.Lineups[0].Player,logoUrl:'https://evil.test/private'}}]});assert.equal(unsafe.Lineups[0].Player.logoUrl,null);
  const fallback=enrichBroadcastLineup(detail,null,metadata);assert.equal(fallback.Lineups.length,1);
});
test('multi-point insight and each goal retain the same verified portrait as the roster; rendered lineup and insight show portraits and club identity',()=>{
  const events={gameId:id(1),GameEventGoals:[1,2].map(n=>({gameEventGoalId:id(20+n),scoredByTeamId:id(4),scoredByPlayerId:id(6),gameTime:n+':00',period:1}))};
  const m=broadcastMatch(detail,events,enrichBroadcastLineup(detail,privateLineup,metadata));assert.equal(m.insights[0].imageUrl,m.roster[0].imageUrl);assert.equal(m.goals[0].scorer.imageUrl,m.roster[0].imageUrl);
  const game={match:m,'Home Team':'REX','Away Team':'Pigeons',homeLogo:'https://example.com/rex.png'};
  assert.match(renderMatchLayer(game,{layer:'lineup'}),/roster-portrait/);assert.match(renderMatchLayer(game,{layer:'insights'}),/insight-portrait/);assert.match(renderMatchLayer(game,{layer:'insights'}),/rex.png/);
});
const rawStandings=Array.from({length:16},(_,i)=>({TeamId:i===2?id(4):i===11?id(5):id(100+i),'Team Name':i===2?'REX':i===11?'Pigeons':'Team '+(i+1),'Total Games':7,'Total Points':i===2?19:i===11?4:30-i,TeamLogo:photo}));
test('standings retain complete API order and original ranks before the two teams are selected, including a gap between ranks 3 and 12',()=>{
  const rows=officialStandings(rawStandings),excerpt=standingsExcerpt(rows,id(4),id(5));assert.deepEqual(excerpt.map(r=>r.gap?'gap':r.rank),[3,'gap',12]);assert.equal(excerpt[0].points,19);assert.equal(excerpt[2].points,4);assert.deepEqual(standingsExcerpt(rows,id(4),id(5),{view:'full',page:2}).map(r=>r.rank),[9,10,11,12,13,14,15,16]);
  const html=renderLeagueLayer({homeId:id(4),awayId:id(5),league:{standingsAvailable:true,standings:rows,scope:{group:'Division'}}},{layer:'standings'});assert.match(html,/data-rank="3"/);assert.match(html,/data-rank="12"/);assert.match(html,/standing-gap/);assert.doesNotMatch(html,/data-rank="1"/);
  assert.throws(()=>officialStandings([...rawStandings,rawStandings[0]]));assert.throws(()=>officialStandings([{...rawStandings[0],'Total Points':null}]));
});
const rawPlayers=[{PlayerId:id(6),TeamId:id(4),FirstName:'Player',LastName:'Home',GP:5,G:3,A:6,P:9,PlayerLogo:photo},{PlayerId:id(7),TeamId:id(5),FirstName:'Away',LastName:'Player',GP:4,G:2,A:1,P:3},{PlayerId:id(8),TeamId:id(99),FirstName:'Foreign',LastName:'Player',GP:100,G:100,A:100,P:200}];
test('official leaders use exact team IDs and accept only sporting images; duplicates never inflate statistics',()=>{
  const teams=officialTeamLeaders([...rawPlayers,rawPlayers[0]],detail);assert.equal(teams.home.length,1);assert.equal(teams.home[0].points,9);assert.match(teams.home[0].imageUrl,/cropped_md/);assert.equal(teams.away.length,1);
  assert.throws(()=>officialTeamLeaders([...rawPlayers,{...rawPlayers[0],G:9}],detail));assert.equal(officialTeamLeaders([{...rawPlayers[0],PlayerLogo:'http://127.0.0.1/private'}],detail).home[0].imageUrl,null);
});
test('league reads use authenticated game scope for public queries, never send bearer credentials, and retain independent source availability',async()=>{
  const urls=[];const result=await broadcastLeague(detail,{fetchImpl:async(url,init)=>{urls.push(String(url));assert.equal(init.headers.authorization,undefined);assert.match(String(url),/000000000003/);return {ok:true,headers:{get:()=>null},json:async()=>String(url).includes('/standings')?rawStandings:rawPlayers};}});
  assert.equal(result.standingsAvailable,true);assert.equal(result.leadersAvailable,true);assert.equal(urls.length,2);
  const partial=await broadcastLeague(detail,{fetchImpl:async url=>({ok:String(url).includes('playersStats'),json:async()=>rawPlayers})});assert.equal(partial.standingsAvailable,false);assert.equal(partial.leadersAvailable,true);
});
test('new sidebar and standings settings survive validated OBS state; missing data never becomes zero ranks',()=>{
  const env={HMS_EUCHL_ORGANIZATION_ID:id(2),HMS_EUCHL_API_TOKEN:'token'},state={org:'EUCHL',gameId:id(1),layer:'leaders-strip',side:'home',lang:'en',period:'current',page:1,insight:'',visible:true,standingsView:'opponents'};
  assert.equal(channelState(state,env).layer,'leaders-strip');assert.equal(channelState({...state,layer:'standings',standingsView:'full'},env).standingsView,'full');assert.throws(()=>channelState({...state,standingsView:'fake'},env));
  const html=renderLeagueLayer({league:{standingsAvailable:false}},{layer:'standings',lang:'en'});assert.match(html,/unavailable/);assert.doesNotMatch(html,/data-rank="0"/);
});
