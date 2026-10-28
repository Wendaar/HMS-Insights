import {buildGameTimeline} from './game-timeline.js';
import {isGameId} from './game-summary.js';
const id=v=>typeof v==='string'?v.toLowerCase():'';
const date=v=>v instanceof Date?v.toISOString().slice(0,10):String(v??'').slice(0,10);
export function formIndex(results){return results.length?Math.round(100*results.reduce((s,g)=>s+({W:3,D:1,L:0}[g.result]??0),0)/(results.length*3)):null;}
// Reuse the exact conservative game-report model. Aggregate denominators, never
// average game percentages. An unsupported or missing game suppresses the rate.
export function teamSpecialTeams(games,teamId,{complete=true,expected=games.length}={}){
 const totals={goals:0,opportunities:0,conceded:0,shorthanded:0};let covered=0;
 for(const game of games){const model=buildGameTimeline(game).specialTeams,s=model?.teams?.[id(teamId)];
  if(!model?.available||!s||s.opportunities===null||s.shorthanded===null)continue;
  covered++;totals.goals+=s.PP;totals.opportunities+=s.opportunities;totals.conceded+=s.concededPP;totals.shorthanded+=s.shorthanded;
 }
 const available=complete&&expected>0&&games.length===expected&&covered===expected;
 return {...totals,covered,total:expected,available,ppPercentage:available&&totals.opportunities?100*totals.goals/totals.opportunities:null,pkPercentage:available&&totals.shorthanded?100*(1-totals.conceded/totals.shorthanded):null};
}
function skaterRoster(game,teamId){
 const roster=game.event_snapshot?.roster;
 const rows=Array.isArray(roster)?roster.filter(p=>id(p.teamId)===id(teamId)):Array.isArray(game.skaters)?game.skaters.filter(p=>id(p.teamId)===id(teamId)):null;
 if(!rows?.length||rows.some(p=>!isGameId(p.id)||(Array.isArray(roster)&&typeof p.isGoalie!=='boolean')))return null;
 if(new Set(rows.map(p=>id(p.id))).size!==rows.length)return null;
 return new Set(rows.filter(p=>p.isGoalie!==true).map(p=>id(p.id)));
}
export function teamRosterTrend(games,teamId,{complete=true,expected=games.length}={}){
 const sorted=[...games].sort((a,b)=>(date(a.played_on)+String(a.started_at??'')+id(a.game_id)).localeCompare(date(b.played_on)+String(b.started_at??'')+id(b.game_id)));
 const unique=new Set(),series=[];let covered=0,previous=null,similarity=0,pairs=0;
 for(const game of sorted){const roster=skaterRoster(game,teamId),home=id(game.home_team_id)===id(teamId),gf=Number(home?game.home_score:game.away_score),ga=Number(home?game.away_score:game.home_score);
  if(roster){covered++;for(const p of roster)unique.add(p);}
  let overlap=null;
  if(roster?.size&&previous?.size){const common=[...roster].filter(p=>previous.has(p)).length;overlap=200*common/(roster.size+previous.size);similarity+=overlap;pairs++;}
  series.push({id:id(game.game_id),date:date(game.played_on),opponentId:id(home?game.away_team_id:game.home_team_id),venue:typeof game.venue_name==='string'?game.venue_name.slice(0,160):null,opponent:String(home?game.away_team_name:game.home_team_name).slice(0,160),score:`${gf}:${ga}`,result:gf>ga?'W':gf===ga?'D':'L',skaters:roster?.size??null,overlap});previous=roster;
 }
 const all=complete&&expected>0&&covered===expected;
 return {series,covered,total:expected,complete:all,unique:covered?unique.size:null,average:covered?series.reduce((s,g)=>s+(g.skaters??0),0)/covered:null,stability:pairs?similarity/pairs:null,pairs,possiblePairs:Math.max(0,expected-1),stabilityComplete:all&&pairs===expected-1&&pairs>0,basis:'dice-consecutive-skater-lineups-v1'};
}
function percentile(teams,team,metric,direction=1){
 const peers=teams.filter(t=>t.games>0&&Number.isFinite(t[metric]));if(peers.length<2||!peers.includes(team))return null;
 const others=peers.filter(t=>t!==team),worse=others.filter(t=>direction*(team[metric]-t[metric])>0).length,ties=others.filter(t=>t[metric]===team[metric]).length;
 return 100*(worse+.5*ties)/others.length;
}
// Editorial gamification within one phase, not official points or predictions.
// Stability and discipline are separate context, never moral judgements of a team.
export function assignTeamRatings(teams){
 for(const team of teams)team.pointsPerGame=team.games>0?team.points/team.games:null;
 for(const team of teams){const components={results:percentile(teams,team,'pointsPerGame'),attack:percentile(teams,team,'offense'),defense:percentile(teams,team,'defense',-1),form:team.formRating};
  const available=Object.values(components).every(Number.isFinite),score=available?Math.round(.4*components.results+.2*components.attack+.2*components.defense+.2*components.form):null;
  const keepers=team.goalies??[],known=keepers.length>0&&keepers.every(g=>Number.isInteger(g.saves)&&Number.isInteger(g.ga)),saves=keepers.reduce((s,g)=>s+(g.saves??0),0),ga=keepers.reduce((s,g)=>s+(g.ga??0),0);
  team.rating={score,stars:score===null?null:Math.round(score/20*10)/10,components,weights:{results:.4,attack:.2,defense:.2,form:.2},provisional:team.games<5,version:'hms-stars-phase-v1',goalies:known&&saves+ga>0?100*saves/(saves+ga):null};
 }
 return teams;
}
