import {eventClock,eventPeriod,selectEventGroup,uniqueEvents} from '../hms/event-snapshot.js';
import {sportingImage} from '../../public/game-report-media.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const text=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,160):null;
const count=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const name=p=>text([p?.firstName,p?.lastName].filter(v=>typeof v==='string').join(' '))||text(p?.name);
// This public model contains sporting fields only. Never forward raw HMS objects.
export function broadcastMatch(detail,events,lineup){
  const gameId=detail.gameId,home=detail.homeTeamId??detail.HomeTeam?.teamId,away=detail.awayTeamId??detail.AwayTeam?.teamId;
  const side=id=>same(id,home)?'home':same(id,away)?'away':null;
  if(events?.gameId&&!same(events.gameId,gameId))events=null;
  if(lineup?.gameId&&!same(lineup.gameId,gameId))lineup=null;
  const rows=Array.isArray(lineup)?lineup:Array.isArray(lineup?.Lineups)?lineup.Lineups:null;
  const players=new Map();
  for(const row of rows??[]){
    if(row.isDeleted||row.gameId&&!same(row.gameId,gameId)||!side(row.teamId)||!text(row.playerId))continue;
    const playerName=name(row.Player)||text(row.name);if(!playerName)continue;
    players.set(row.playerId.toLowerCase(),{id:row.playerId,name:playerName,side:side(row.teamId),number:count(row.number),goalie:row.ListPosition?.isGoalie===true,imageUrl:sportingImage(row.Player?.imageUrls?.md??row.Player?.logoUrl??row.Player?.avatarUrl)});
  }
  const person=(id,embedded)=>{const known=players.get(String(id??embedded?.playerId).toLowerCase());return {id:text(id??embedded?.playerId),name:known?.name??name(embedded),imageUrl:known?.imageUrl??sportingImage(embedded?.imageUrls?.md??embedded?.logoUrl)};};
  const group=selectEventGroup(events,detail,'GameEventGoals','goal');
  const goals=uniqueEvents(group.events,'goal').filter(e=>!e.isDeleted).map((e,index)=>({
    id:text(e.eventId??e.gameEventGoalId)??`goal-${index}`,side:side(e.scoredByTeamId??e.ScoredByTeam?.teamId),
    period:eventPeriod(e.period),clock:eventClock(e.gameTime)===null?null:String(e.gameTime),seconds:eventClock(e.gameTime),
    scorer:person(e.scoredByPlayerId,e.ScoredByPlayer),
    assists:[person(e.assistedBy1PlayerId,e.AssistedBy1Player),person(e.assistedBy2PlayerId,e.AssistedBy2Player)].filter(p=>p.id||p.name),
  }));
  const score={home:count(detail.HomeTeamGoals),away:count(detail.AwayTeamGoals)};
  const consistent=group.available&&score.home!==null&&score.away!==null&&goals.every(g=>g.side)
    &&goals.filter(g=>g.side==='home').length===score.home&&goals.filter(g=>g.side==='away').length===score.away;
  const periodsAvailable=consistent&&goals.every(g=>g.period!==null);
  const ordered=goals.every(g=>g.period!==null&&g.seconds!==null)&&new Set(goals.map(g=>`${g.period}:${g.seconds}`)).size===goals.length;
  if(ordered)goals.sort((a,b)=>a.period-b.period||a.seconds-b.seconds);
  const running={home:0,away:0};
  for(const g of goals){if(consistent&&ordered){running[g.side]++;g.scoreAfter={...running};}else g.scoreAfter=null;delete g.seconds;}
  const stats=new Map();
  if(consistent)for(const g of goals){
    const add=(p,type)=>{if(!p.id||!p.name)return;const key=p.id.toLowerCase();const known=players.get(key);if(known&&known.side!==g.side)return;
      const stat=stats.get(key)??{id:p.id,name:p.name,side:g.side,goals:0,assists:0};stat[type]++;stats.set(key,stat);};
    add(g.scorer,'goals');const seen=new Set([g.scorer.id?.toLowerCase()]);for(const p of g.assists){const key=p.id?.toLowerCase();if(!seen.has(key)){add(p,'assists');seen.add(key);}}
  }
  const insights=[...stats.values()].map(p=>({...p,points:p.goals+p.assists})).filter(p=>p.points>=2)
    .sort((a,b)=>b.goals-a.goals||b.points-a.points||a.id.localeCompare(b.id))
    .map(p=>({...p,type:p.goals>=3?'hat-trick':'multi-point'}));
  return {score,goals,ordered,coverage:consistent?'matches-score':group.available?'score-mismatch':'unavailable',
    periods:periodsAvailable?Array.from({length:Math.max(3,...goals.map(g=>g.period))},(_,i)=>({period:i+1,
      home:goals.filter(g=>g.side==='home'&&g.period===i+1).length,away:goals.filter(g=>g.side==='away'&&g.period===i+1).length})):[],
    roster:[...players.values()].sort((a,b)=>Number(b.goalie)-Number(a.goalie)||(a.number??Infinity)-(b.number??Infinity)||a.name.localeCompare(b.name)),
    lineupAvailable:rows!==null,insights};
}
