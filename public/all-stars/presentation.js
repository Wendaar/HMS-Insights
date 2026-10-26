import {fonts} from '../studio/typography.js';
export {fonts};
export const formats={'16:9':[1920,1080],'16:10':[1600,1000],'1:1':[1080,1080],'4:5':[1080,1350],'9:16':[1080,1920]};
export const templates=['rink','cards'];
export const graphicDefaults={format:'16:9',design:'pantha',template:'rink',font:'Hitch Grotesk'};
const designNames=['clean','crazy','artistic','technical','pantha'];
export function graphicSettings(input={},org='phm'){
  const value=input&&typeof input==='object'?input:{};
  const defaults=String(org).toLowerCase()==='phm'?graphicDefaults:{...graphicDefaults,design:'clean',font:'Barlow Condensed'};
  return {format:Object.hasOwn(formats,value.format)?value.format:defaults.format,
    design:designNames.includes(value.design)?value.design:defaults.design,
    template:templates.includes(value.template)?value.template:defaults.template,
    font:fonts.includes(value.font)?value.font:defaults.font};
}
// Apply filters before paging; position/search/context changes reset the visible window.
export const CANDIDATE_PAGE_SIZE=20;
export function candidatePage(candidates,{team='',search='',limit=CANDIDATE_PAGE_SIZE}={}){
  const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const query=fold(search),filtered=candidates.filter(p=>(!team||p.teamId===team)&&(!query||fold(p.name+' '+p.team).includes(query)));
  const count=Number.isInteger(limit)&&limit>0?limit:CANDIDATE_PAGE_SIZE;
  return {items:filtered.slice(0,count),total:filtered.length,hasMore:filtered.length>count};
}
