export const defaultPronunciations=[['PHM Cup','PHM Kap'],['Kyle Poirier','Kajl Poariér']];
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function pronunciationRules(value){
  return String(value??'').split(/\r?\n/).slice(0,50).map(line=>line.split('=').map(s=>s.trim())).filter(row=>row.length===2&&row.every(s=>s.length>0&&s.length<=120));
}
export function spokenText(text,rules=defaultPronunciations,language='cs'){
  if(language!=='cs')return String(text);
  let result=String(text);for(const [from,to] of [...rules].sort((a,b)=>b[0].length-a[0].length))result=result.replace(new RegExp('(?<![\\p{L}\\p{N}])'+escape(from)+'(?![\\p{L}\\p{N}])','giu'),()=>to);
  return result;
}
export function speechParts(text){return (String(text).match(/[^.!?;,]+[.!?;,]*/gu)??[]).map(s=>s.trim()).filter(Boolean);}
