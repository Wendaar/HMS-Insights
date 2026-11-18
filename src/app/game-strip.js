import {widgetContext} from './widgets.js';
import {readSeason} from './season-games.js';
import {calendarDate} from '../domain/season-games.js';
import {readOfficialStandings} from './broadcast-league.js';
import {loadStripReports} from '../infrastructure/postgres-repository.js';
import {stripMedia} from './game-strip-media.js';
import {flickrAlbum} from '../../public/game-report-media.js';

// Navigation is over playing days, not calendar offsets. The response contains
// at most nine day choices and twenty fixtures; the season index is shared.
export function stripSelection(rows,input={},now=new Date(),timeZone='Europe/Prague'){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const dates=[...new Set(rows.map(g=>g.date))].sort();
 if(input.date!==undefined&&!calendarDate(input.date))throw new TypeError('strip date');
 const offset=Number(input.offset??0);if(!Number.isSafeInteger(offset)||offset<0||offset>20000||offset%20)throw new TypeError('strip offset');
 const anchor=dates.find(d=>d>=today)??dates.at(-1)??null;
 const selected=input.date??anchor;
 if(selected&&!dates.includes(selected))throw new TypeError('Unknown playing day');
 const index=dates.indexOf(selected),items=rows.filter(g=>g.date===selected).sort((a,b)=>(a.time??'99:99').localeCompare(b.time??'99:99')||a.id.localeCompare(b.id));
 return {today,anchor,date:selected,dates:dates.slice(Math.max(0,index-4),index+5),previous:dates[index-1]??null,next:dates[index+1]??null,items:items.slice(offset,offset+20),offset,total:items.length,hasMore:items.length>offset+20,timeZone};
}
async function buildGameStrip(org,input={},options={}){
 const context=await widgetContext(org,input,options),{scope,directory}=context;
 const all=await(options.readSeason??readSeason)(scope.seasonId,options);
 // Never accept foreign groups/phases simply because a public response used a
 // requested season ID. The organization-bound directory is authoritative.
 const groups=new Map(directory.groups.map(g=>[g.id,g]));
 const rows=all.filter(g=>groups.get(g.group.id)?.phases.some(p=>p.id===g.phase.id)&&(!scope.groupId||g.group.id===scope.groupId)&&(!scope.phaseId||g.phase.id===scope.phaseId)&&(!scope.teamId||[g.home.id,g.away.id].includes(scope.teamId)));
 const page=stripSelection(rows,input,options.now,context.season.timeZone??'Europe/Prague');
 const tables=new Map(),jobs=[...new Set(page.items.map(g=>g.group.id))];let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{while(cursor<jobs.length){const id=jobs[cursor++];try{tables.set(id,await(options.readStandings??readOfficialStandings)({groupId:id},options));}catch{/* Optional ranks/short names stay absent. */}}}));
 let reports=new Map();
 if(page.items.length&&((options.env??process.env).DATABASE_URL||options.loadReports))try{reports=new Map((await(options.loadReports??loadStripReports)(page.items.map(g=>g.id),scope.seasonId,scope.organisationId,{env:options.env})).map(r=>[r.game_id.toLowerCase(),r]));}catch{/* No fabricated report links. */}
 const media=await(options.stripMedia??stripMedia)(context,page.items,options);
 const teams=new Map(directory.teams.map(t=>[t.id,t]));
 const items=page.items.map(g=>{
  const team=t=>{const official=tables.get(g.group.id)?.find(r=>r.id===t.id),member=teams.get(t.id),ownGroup=member?.groupIds?.includes(g.group.id);
   return {...t,shortName:official?.shortName??null,logoUrl:t.logoUrl??official?.logoUrl??member?.logoUrl??null,rank:['NOT PLAYED','SCHEDULED'].includes(g.status)&&ownGroup?official?.rank??null:null,rankGroup:ownGroup?groups.get(g.group.id).name:null};};
  const links=media.get(g.id)??{};
  return {...g,home:team(g.home),away:team(g.away),media:{albumUrl:links.albumUrl??flickrAlbum(reports.get(g.id)?.album_url),youtubeUrl:links.youtubeUrl??null},reportUrl:reports.has(g.id)?'/game-center/'+g.id+'/public':null,detailUrl:reports.has(g.id)?null:'https://prod.hms.wootera.net/embed/game?'+new URLSearchParams({gameId:g.id})};
 });
 return {...page,items,scope,branding:context.branding,source:'HMS',readAt:new Date().toISOString()};
}

const cache=new Map(),pending=new Map();
export async function readGameStrip(org,input={},options={}){
 if(Object.keys(options).length)return buildGameStrip(org,input,options);
 const key=org+':'+JSON.stringify(input);
 if(cache.get(key)?.until>Date.now())return cache.get(key).value;
 if(pending.has(key))return pending.get(key);if(pending.size>=16)throw new Error('Game Strip busy');
 const task=buildGameStrip(org,input,options).then(value=>{if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+60000});return value;});
 pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
