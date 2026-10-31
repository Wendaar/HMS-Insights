export const cues=[['pregame','PREGAME MIX'],['puckdrop','PUCK DROP'],['goal','GOAL'],['powerplay','POWER PLAY'],['ingame','IN GAME MIX'],['victory','VICTORY']].flatMap(([kind,label])=>['HOME','AWAY'].map(side=>[`${kind}-${side.toLowerCase()}`,label,side,kind]));
export function adCues(ads){return ads.map((ad,i)=>[`ad:${ad.id}`,`AD ${i+1}`,ad.name,`ad:${ad.id}`]);}
export function cueChannel(kind){return ['pregame','ingame','victory'].includes(kind)?'bed':'effect';}
export const signature=e=>JSON.stringify([e.type,e.side,e.period,e.clock,e.text]);
export function reconcile(previous,incoming,types){
  const old=new Map(previous.map(e=>[e.id,e])),seen=new Set();
  const next=incoming.map(e=>{
    if(seen.has(e.id))throw new Error('Konfliktní nebo duplicitní události.');seen.add(e.id);
    const identities=new Set([e.id,...(e.members??[])]);
    const exact=old.get(e.id),overlap=previous.find(p=>!p.withdrawn&&[p.id,...(p.members??[])].some(id=>identities.has(id)));
    const before=exact&&!exact.withdrawn?exact:overlap??exact,unchanged=before&&signature(before)===signature(e);
    return {...e,status:unchanged?before.status:'New',edited:!!before&&(!unchanged||before.edited),withdrawn:false};
  });
  // Keep tombstones: removal must never turn a historical item into a new announcement.
  for(const e of previous)if(!seen.has(e.id))next.push(types.includes(e.type)?{...e,status:'Skipped',withdrawn:true}:e);
  return next;
}
export function profileKeys(org,team,kind){
  return [...(team?[`show:v1:${org}:team:${team.toLowerCase()}:${kind}`]:[]),`show:v1:${org}:organization:${kind}`,`show:v1:${org}:default:${kind}`];
}
export function ledgerKey(org,game,mode){return `show:events:v1:${org}:${mode}:${game.toLowerCase()}`;}
