import {isGameId} from './game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
export const GAME_PAGE_SIZE=20;
export class InvalidScheduleQuery extends TypeError {}
export const GAME_FILTERS=['Today','Yesterday','+7 days','-7 days','Past','Future','Date'];
const text=value=>typeof value==='string'?value.replace(/[\x00-\x1f]/g,' ').trim().slice(0,240)||null:null;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const count=value=>value!==null&&value!==undefined&&value!==''&&Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
export function calendarDate(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function seasonGamesQuery(query={},now=new Date()){
  if(!isGameId(query.seasonId))throw new InvalidScheduleQuery('seasonId');
  const filter=query.filter??'Today',offset=Number(query.offset??0),windowPage=Number(query.windowPage??0);
  if(!GAME_FILTERS.includes(filter)||Array.isArray(query.offset)||Array.isArray(query.windowPage)||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%GAME_PAGE_SIZE||!Number.isSafeInteger(windowPage)||windowPage<0||windowPage>520)throw new InvalidScheduleQuery('pagination');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const shift=n=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
  const ranges={Today:[0,0],Yesterday:[-1,-1],'+7 days':[1,7],'-7 days':[-7,-1],Past:[-7*(windowPage+1),-1-7*windowPage],Future:[1+7*windowPage,7*(windowPage+1)]};
  let dates;
  if(filter==='Date'){if(!calendarDate(query.date))throw new InvalidScheduleQuery('date');dates=[query.date];}
  else {const [from,to]=ranges[filter];dates=Array.from({length:to-from+1},(_,i)=>shift(from+i));}
  const uuid=key=>{if(query[key]!==undefined&&query[key]!==''&&!isGameId(query[key]))throw new InvalidScheduleQuery(key);return query[key]?.toLowerCase()||'';};
  if(query.q!==undefined&&typeof query.q!=='string')throw new InvalidScheduleQuery('q');
  return {seasonId:query.seasonId.toLowerCase(),filter,offset,windowPage,dates,from:dates[0],to:dates.at(-1),groupId:uuid('groupId'),phaseId:uuid('phaseId'),teamId:uuid('teamId'),q:(query.q??'').trim().slice(0,80)};
}
export function officialNames(value){
  const entries=Array.isArray(value)?value:[value];
  return [...new Set(entries.slice(0,12).map(p=>typeof p==='string'?text(p):p&&typeof p==='object'?text(p.name)??text([p.firstName,p.lastName].filter(v=>typeof v==='string').join(' ')):null).filter(Boolean))].join(', ').slice(0,360)||null;
}
export function publicSeasonGame(game,seasonId,date){
  const season=game?.Phase?.Group?.Season;
  if(!same(season?.seasonId,seasonId)||game.startDate!==date||!isGameId(game.gameId)||game.isDeleted)throw new Error('HMS returned an invalid season/day fixture');
  const team=value=>{
    return {id:isGameId(value?.teamId)?value.teamId.toLowerCase():null,name:text(value?.name),logoUrl:sportingImage(value?.logoUrl)??sportingImage(value?.logoUrls?.md)};
  };
  const status=text(game.status)?.toUpperCase()??'UNKNOWN';
  const live=['PLAYING','IN PROGRESS','IN_PROGRESS','LIVE','STARTED'].includes(status);
  const scored=status==='FINISHED'||live;
  const reference=value=>({id:isGameId(value?.groupId??value?.phaseId)?(value.groupId??value.phaseId).toLowerCase():null,name:text(value?.name)});
  return {id:game.gameId.toLowerCase(),date,time:/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(game.startTime??'')?game.startTime.slice(0,5):null,status,live,
    home:{...team(game.HomeTeam),score:scored?count(game.HomeTeamGoals):null},away:{...team(game.AwayTeam),score:scored?count(game.AwayTeamGoals):null},
    venue:text(game.Venue?.name),group:reference(game.Phase?.Group),phase:reference(game.Phase),name:text(game.name),
    referee:officialNames(game.referee),timekeeper:officialNames(game.timekeeper),competition:text(season.Competition?.name),season:text(season.name),reportAvailable:false};
}
const search=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function seasonGamePage(rows,query){
  const unique=new Map();for(const row of rows){if(unique.has(row.id)&&JSON.stringify(unique.get(row.id))!==JSON.stringify(row))throw new Error('Conflicting fixture');unique.set(row.id,row);}
  const all=[...unique.values()];
  const choices=(values)=>[...new Map(values.filter(v=>v.id&&v.name).map(v=>[v.id,v])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  const options={groups:choices(all.map(g=>g.group)),phases:choices(all.map(g=>g.phase)),teams:choices(all.flatMap(g=>[g.home,g.away]))};
  const filtered=all.filter(g=>(!query.groupId||g.group.id===query.groupId)&&(!query.phaseId||g.phase.id===query.phaseId)&&(!query.teamId||[g.home.id,g.away.id].includes(query.teamId))&&(!query.q||search([g.home.name,g.away.name,g.venue,g.name,g.referee,g.timekeeper].join(' ')).includes(search(query.q))));
  const reverse=['Past','-7 days'].includes(query.filter)?-1:1;
  filtered.sort((a,b)=>reverse*((a.date+(a.time??'99:99')).localeCompare(b.date+(b.time??'99:99')))||a.id.localeCompare(b.id));
  return {items:filtered.slice(query.offset,query.offset+GAME_PAGE_SIZE),total:filtered.length,hasMore:filtered.length>query.offset+GAME_PAGE_SIZE,offset:query.offset,limit:GAME_PAGE_SIZE,options};
}
