export const rotationDefaults={enabled:false,showSeconds:15,pauseSeconds:30,startedAt:0};
export function normalizeRotation(value){
  if(!value||typeof value.enabled!=='boolean')throw new TypeError('Invalid sponsor rotation');
  const {enabled,showSeconds,pauseSeconds,startedAt}=value;
  if(!Number.isInteger(showSeconds)||showSeconds<1||showSeconds>300||!Number.isInteger(pauseSeconds)||pauseSeconds<0||pauseSeconds>3600||!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>8640000000000000)throw new TypeError('Invalid sponsor timing');
  return {enabled,showSeconds,pauseSeconds,startedAt};
}
export function sponsorFrame(items,rotation=rotationDefaults,now=Date.now()){
  if(!items?.length)return {item:null,phase:'blank',opacity:0,key:'empty'};
  if(!rotation.enabled)return {item:items[0],phase:'show',opacity:1,key:items[0].id+':held'};
  const spans=items.map(item=>({item,show:1000*(item.showSeconds??rotation.showSeconds),pause:1000*(item.pauseSeconds??rotation.pauseSeconds)}));
  const total=spans.reduce((n,s)=>n+s.show+s.pause,0);if(!Number.isFinite(total)||total<=0)return {item:null,phase:'blank',opacity:0,key:'invalid'};
  const elapsed=Math.max(0,now-rotation.startedAt),cycle=Math.floor(elapsed/total);let time=elapsed%total;
  for(let i=0;i<spans.length;i++){
    const span=spans[i];
    if(time<span.show)return {item:span.item,phase:'show',opacity:Math.max(0,Math.min(1,time/400,(span.show-time)/400)),key:span.item.id+':'+i+':'+cycle};
    time-=span.show;
    if(time<span.pause)return {item:null,phase:'blank',opacity:0,key:'blank:'+i+':'+cycle};
    time-=span.pause;
  }
  return {item:null,phase:'blank',opacity:0,key:'blank'};
}
export function readSponsorPreferences(org,scope='organization',targetId=''){
  try{const value=JSON.parse(localStorage.getItem(`hms-sponsors:v1:${org}:${scope}:${targetId}`)||'null');return value&&Array.isArray(value.choices)?value:null;}catch{return null;}
}
export function saveSponsorPreferences(org,scope,targetId,value){localStorage.setItem(`hms-sponsors:v1:${org}:${scope}:${targetId}`,JSON.stringify(value));}
