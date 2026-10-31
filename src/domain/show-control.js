import {selectEventGroup, uniqueEvents, eventClock, eventPeriod} from '../hms/event-snapshot.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const text=v=>typeof v==='string'?v.trim().slice(0,240):'';
const person=p=>text([p?.firstName,p?.lastName].filter(v=>typeof v==='string').join(' '))||text(p?.name);

// Only explicit LIVE collections are authoritative. Never fall back to old detail events.
export function showControlFeed(detail,response,roster=[]){
  if(!response||response.gameId&&!same(response.gameId,detail.gameId))return null;
  const events=[],types=[];let omitted=0;
  for(const [type,key] of [['goal','GameEventGoals'],['penalty','GameEventPenalties']]){
    const group=selectEventGroup(response,{},key,type);if(!group.available)continue;types.push(type);
    for(const e of uniqueEvents(group.events,type)){
      if(e.gameId&&!same(e.gameId,detail.gameId)){omitted++;continue;}
      const id=text(e.eventId??e[type==='goal'?'gameEventGoalId':'gameEventPenaltyId']);
      if(!id){omitted++;continue;} // Position or text is not a safe event identity.
      if(e.isDeleted)continue;
      const teamId=type==='goal'?e.scoredByTeamId??e.ScoredByTeam?.teamId:e.penalizedTeamId??e.PenalizedTeam?.teamId;
      const side=same(teamId,detail.homeTeamId??detail.HomeTeam?.teamId)?'home':same(teamId,detail.awayTeamId??detail.AwayTeam?.teamId)?'away':null;
      if(!side){omitted++;continue;}
      const embedded=type==='goal'?e.ScoredByPlayer:e.PenalizedPlayer;
      const playerId=type==='goal'?e.scoredByPlayerId:e.penalizedPlayerId;
      const playerName=(id,p)=>roster.find(r=>same(r.id,id)&&r.side===side)?.name||
        ((!id||!p?.playerId||same(id,p.playerId))&&(!p?.teamId||same(p.teamId,teamId))?person(p):'');
      const team=text(detail[side==='home'?'HomeTeam':'AwayTeam']?.name)|| (side==='home'?'domácích':'hostů');
      const name=playerName(playerId,embedded);
      const assists=type==='goal'?[playerName(e.assistedBy1PlayerId,e.AssistedBy1Player),playerName(e.assistedBy2PlayerId,e.AssistedBy2Player)].filter(Boolean):[];
      const announcement=type==='goal'?`Gól týmu ${team}.${name?` Střelec ${name}.`:''}${assists.length?` Asistence ${assists.join(', ')}.`:''}`:
        `Vyloučení týmu ${team}.${name?` Hráč ${name}.`:''}`;
      events.push({id:`${type}:${id.toLowerCase()}`,type,side,period:eventPeriod(e.period),clock:eventClock(e.gameTime)===null?null:String(e.gameTime),text:announcement});
    }
  }
  events.sort((a,b)=>(a.period??0)-(b.period??0)||(eventClock(a.clock)??0)-(eventClock(b.clock)??0)||a.id.localeCompare(b.id));
  return types.length?{events,types,omitted}:null;
}
