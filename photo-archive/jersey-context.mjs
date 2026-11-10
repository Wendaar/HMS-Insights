export const ANALYSIS_VERSION=2;
export const jerseyFamilies=['white','black','grey','red','blue','green','yellow','orange','purple','unknown'];
export function matchJersey(value){
  if(typeof value!=='string')return null;
  const v=value.trim();return /^#[\da-f]{6}$/i.test(v)?v.toLowerCase():/^#[\da-f]{3}$/i.test(v)?'#'+[...v.slice(1)].map(c=>c+c).join('').toLowerCase():null;
}
export function jerseyFamily(value){
  const hex=matchJersey(value);if(!hex)return 'unknown';
  const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(max<0.22)return 'black';if(delta<0.13)return max>0.8?'white':'grey';
  let h=delta===0?0:max===r?60*((g-b)/delta%6):max===g?60*((b-r)/delta+2):60*((r-g)/delta+4);if(h<0)h+=360;
  return h<18 || h>=340?'red':h<45?'orange':h<70?'yellow':h<170?'green':h<265?'blue':'purple';
}
export function withMatchJerseys(teams,detail){
  return teams.map((team,i)=>{const hex=matchJersey(detail[i===0?'homeJerseyColor':'awayJerseyColor']);
    return {...team,jerseyColor:hex,jerseyFamily:jerseyFamily(hex),jerseySource:hex?'hms-game':null};});
}
export function resolveJerseyTeam(observation,teams=[]){
  const known=teams.filter(t=>t.jerseySource==='hms-game' && t.jerseyFamily && t.jerseyFamily!=='unknown');
  if(!(observation.jerseyColorConfidence>=0.85) || !observation.jerseyColor || observation.jerseyColor==='unknown' || known.length!==2 || known[0].jerseyFamily===known[1].jerseyFamily)return null;
  return known.find(t=>t.jerseyFamily===observation.jerseyColor)?.teamId || null;
}
