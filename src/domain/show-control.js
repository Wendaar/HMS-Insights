import {selectEventGroup, uniqueEvents, eventClock, eventPeriod} from '../hms/event-snapshot.js';
import {penaltyDetails} from './goal-details.js';
import {hmsMediaContext} from '../hms/media-context.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const text=v=>typeof v==='string'?v.trim().slice(0,240):'';
const person=p=>text([p?.firstName,p?.lastName].filter(v=>typeof v==='string').join(' '))||text(p?.name);
const integer=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const words=['nula','jedna','dva','tři','čtyři','pět','šest','sedm','osm','devět','deset','jedenáct','dvanáct','třináct','čtrnáct','patnáct','šestnáct','sedmnáct','osmnáct','devatenáct'];
export function spokenNumber(n){if(!Number.isSafeInteger(n)||n<0)return '';if(n<20)return words[n];if(n<100)return ['','','dvacet','třicet','čtyřicet','padesát','šedesát','sedmdesát','osmdesát','devadesát'][Math.floor(n/10)]+(n%10?' '+words[n%10]:'');return String(n);}
export function spokenClock(clock){if(eventClock(clock)===null)return '';return 'Čas '+String(clock).split(':').map(v=>(Number(v)<10?'nula ':'')+spokenNumber(Number(v))).join(' ')+'. ';}
const ordinals=['','První','Druhou','Třetí','Čtvrtou','Pátou','Šestou','Sedmou','Osmou','Devátou','Desátou'];
const penaltyLabels={minor:'menší trest','minor penalty':'menší trest',major:'větší trest','major penalty':'větší trest',misconduct:'osobní trest',slashing:'sekání',roughing:'hrubost','cross-checking':'krosček','cross checking':'krosček',tripping:'podražení',hooking:'hákování',holding:'držení',interference:'nedovolené bránění',boarding:'vražení na hrazení','high sticking':'vysoká hůl','high-sticking':'vysoká hůl'};
const penaltyLabel=value=>penaltyLabels[text(value).toLowerCase()]||text(value);

// LIVE collections and verified sporting detail only; no historical-event fallback.
export function showControlFeed(detail,response,roster=[],{match,metadata}={}){
  if(response?.gameId&&!same(response.gameId,detail.gameId))return null;
  const events=[],types=[];let omitted=0;
  const teamId=side=>detail[side+'TeamId']??detail[side==='home'?'HomeTeam':'AwayTeam']?.teamId;
  const teamName=side=>text(detail[side==='home'?'HomeTeam':'AwayTeam']?.name)||(side==='home'?'domácích':'hostů');
  const player=(id,p,side)=>{
    if(roster.some(r=>same(r.id,id??p?.playerId)&&r.side!==side))return {name:'',number:null};
    const known=roster.find(r=>same(r.id,id??p?.playerId)&&r.side===side);
    if(known)return {name:known.name,number:integer(known.number),goalie:known.goalie};
    if(id&&p?.playerId&&!same(id,p.playerId)||p?.teamId&&!same(p.teamId,teamId(side)))return {name:'',number:null};
    return {name:person(p),number:null};
  };
  const playerText=p=>`${integer(p.number)===null?'':`číslo ${spokenNumber(integer(p.number))} `}${p.name}`.trim();
  for(const [type,key] of [['goal','GameEventGoals'],['penalty','GameEventPenalties']]){
    const group=selectEventGroup(response,{},key,type);if(!group.available)continue;types.push(type);
    for(const e of uniqueEvents(group.events,type)){
      if(e.gameId&&!same(e.gameId,detail.gameId)){omitted++;continue;}
      const id=text(e.eventId??e[type==='goal'?'gameEventGoalId':'gameEventPenaltyId']);
      if(!id){omitted++;continue;}if(e.isDeleted)continue;
      const tid=type==='goal'?e.scoredByTeamId??e.ScoredByTeam?.teamId:e.penalizedTeamId??e.PenalizedTeam?.teamId;
      const side=same(tid,teamId('home'))?'home':same(tid,teamId('away'))?'away':null;if(!side){omitted++;continue;}
      const p=player(type==='goal'?e.scoredByPlayerId:e.penalizedPlayerId,type==='goal'?e.ScoredByPlayer:e.PenalizedPlayer,side);
      const clock=eventClock(e.gameTime)===null?null:String(e.gameTime),period=eventPeriod(e.period);
      let announcement,penaltyClause;
      if(type==='goal'){
        const verified=match?.coverage==='matches-score'&&match.ordered?match.goals.find(g=>same(g.id,id)):null;
        const score=verified?.scoreAfter,n=score?.[side],ordinal=ordinals[n];
        const assists=[player(e.assistedBy1PlayerId,e.AssistedBy1Player,side),player(e.assistedBy2PlayerId,e.AssistedBy2Player,side)].filter(a=>a.name);
        announcement=spokenClock(clock)+(ordinal?`${ordinal} branku týmu ${teamName(side)} vstřelil `:`Gól týmu ${teamName(side)}! `)+(p.name?`${ordinal?'hráč':'Střelec, hráč'} ${playerText(p)}!`:ordinal?'hráč neuvedený v zápisu.':'')+(assists.length?` ${assists.length===1?'Asistoval hráč':'Asistovali hráči'} ${assists.map(playerText).join(' a ')}.`:'')+(score?` Stav utkání ${spokenNumber(score.home)} ku ${spokenNumber(score.away)}.`:'');
      }else{
        const details=penaltyDetails(e),kind=penaltyLabel(details.type?.name),reason=penaltyLabel(details.subtype?.name);
        penaltyClause=`${p.name?`hráč ${playerText(p)} týmu`:'hráč týmu'} ${teamName(side)}${kind?`, ${kind}`:''}${reason?`, ${reason}`:''}`;
        announcement=spokenClock(clock)+`Vyloučen ${penaltyClause}.`;
      }
      events.push({id:`${type}:${id.toLowerCase()}`,type,side,period,clock,text:announcement,...(penaltyClause?{penaltyClause}:{})});
    }
  }
  events.sort((a,b)=>(a.period??0)-(b.period??0)||(eventClock(a.clock)??0)-(eventClock(b.clock)??0)||a.id.localeCompare(b.id));
  // Same verified period/clock across opposite sides; never infer penalty cancellation.
  const groups=new Map();for(const e of events)if(e.type==='penalty'&&e.period!==null&&e.clock!==null){const key=e.period+':'+e.clock;groups.set(key,[...(groups.get(key)??[]),e]);}
  for(const rows of groups.values())if(new Set(rows.map(e=>e.side)).size>1){
    const first=events.indexOf(rows[0]);for(const row of rows)events.splice(events.indexOf(row),1);
    events.splice(first,0,{id:'penalties:'+rows.map(e=>e.id).sort().join('|'),members:rows.map(e=>e.id),type:'penalty',side:null,period:rows[0].period,clock:rows[0].clock,text:spokenClock(rows[0].clock)+'Současně vyloučeni '+rows.map(e=>e.penaltyClause).join(' a ')+'.'});
  }
  for(const e of events)delete e.penaltyClause;
  const finished=detail.status==='FINISHED',homeScore=integer(detail.HomeTeamGoals),awayScore=integer(detail.AwayTeamGoals);
  types.push('final','stars');
  if(finished&&homeScore!==null&&awayScore!==null){
    const brand=hmsMediaContext(detail),competition=text(brand.competitionName),group=text(brand.groupName);
    events.push({id:'final:result',type:'final',side:null,period:null,clock:null,text:`Dámy a pánové, sledovali jsme utkání${competition?' soutěže '+competition:''}${group?', '+group:''}, mezi týmy ${teamName('home')} a ${teamName('away')}. Konečný stav zápasu je ${spokenNumber(homeScore)} ku ${spokenNumber(awayScore)}! Děkujeme oběma týmům i vám, fanouškům!`});
    const matchedMetadata=metadata&&(!metadata.gameId||same(metadata.gameId,detail.gameId))&&same(metadata.HomeTeam?.teamId,teamId('home'))&&same(metadata.AwayTeam?.teamId,teamId('away'))&&metadata.startDate===detail.startDate&&integer(metadata.HomeTeamGoals)===homeScore&&integer(metadata.AwayTeamGoals)===awayScore;
    const source=Array.isArray(detail.GameStars)?detail.GameStars:matchedMetadata?metadata.GameStars:[];
    const stars=[],seen=new Set();for(const s of Array.isArray(source)?source:[]){const id=s.playerId??s.Player?.playerId,side=same(s.teamId,teamId('home'))?'home':same(s.teamId,teamId('away'))?'away':null;
      const p=roster.find(r=>same(r.id,id)&&r.side===side);if(s.isDeleted||s.gameId&&!same(s.gameId,detail.gameId)||!p||seen.has(p.id.toLowerCase()))continue;seen.add(p.id.toLowerCase());stars.push(`Z týmu ${teamName(side)} je hvězdou hráč ${playerText(p)}${p.goalie?', brankář týmu':''}!`);}
    if(stars.length)events.push({id:'stars:official',type:'stars',side:null,period:null,clock:null,text:'Dovolte mi vyhlásit nejlepší hráče zápasu, hvězdy utkání! '+stars.join(' ')+' Gratulujeme a přijďte si převzít své ocenění!'});
  }
  return types.some(t=>['goal','penalty'].includes(t))||finished?{events,types,omitted}:null;
}
