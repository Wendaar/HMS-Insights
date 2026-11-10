import {sportingImage} from '../game-report-media.js';
import {metrics} from './definitions.js';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export const statNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const text=v=>typeof v==='string'?v.trim().slice(0,200):'';
export function officialPlayer(row){
 if(!uuid(row?.PlayerId)||!uuid(row.TeamId))return null;
 const goals=statNumber(row.G),assists=statNumber(row.A);
 return {id:row.PlayerId.toLowerCase(),teamId:row.TeamId.toLowerCase(),name:text([row.FirstName,row.LastName].filter(v=>typeof v==='string').join(' ')),team:text(row.Team??row['Team Name']),teamLogoUrl:sportingImage(row.TeamLogo),imageUrl:sportingImage(row.PlayerLogo),number:statNumber(row.JerseyNumber),position:text(row.Position),games:statNumber(row.GP),goals,assists,points:statNumber(row.P)??(goals!==null&&assists!==null?goals+assists:null),stars:statNumber(row.Stars),pim:statNumber(row.PIM),wins:statNumber(row.W),gaa:statNumber(row.GAA),shutouts:statNumber(row.SO),sv:statNumber(row.SvP)!==null&&statNumber(row.SvP)<=100?statNumber(row.SvP):null};
}
export function officialPlayers(rows){
 if(!Array.isArray(rows)||rows.length>20000)throw new Error('Invalid player statistics');
 const seen=new Map();for(const row of rows){const p=officialPlayer(row);if(!p||!p.name)continue;const key=p.id+'|'+p.teamId;if(seen.has(key)&&JSON.stringify(seen.get(key))!==JSON.stringify(p))throw new Error('Ambiguous player statistics');seen.set(key,p);}return [...seen.values()].map((p,sourceOrder)=>({...p,sourceOrder}));
}
// The metric determines the rank; secondary ordering only stabilizes tied rows.
export function rankLeaders(players,metric,limit=5){
 const definition=metrics[metric];if(!definition)throw new TypeError('metric');
 const field=definition.field,sorted=players.filter(p=>Number.isFinite(p[field])&&p.games>0).sort((a,b)=>definition.direction*(a[field]-b[field])||(definition.tieBreak==='sourceOrder'?(a.sourceOrder??0)-(b.sourceOrder??0):0)||a.name.localeCompare(b.name,'cs')||a.id.localeCompare(b.id)||(a.teamId??'').localeCompare(b.teamId??''));
 const counts=new Map();for(const p of sorted)counts.set(p[field],(counts.get(p[field])??0)+1);
 let previous=null,rank=0;return sorted.map((p,i)=>{if(p[field]!==previous)rank=i+1;previous=p[field];return {...p,value:p[field],rank,tied:counts.get(p[field])>1};}).slice(0,limit);
}
