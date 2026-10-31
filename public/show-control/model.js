export const cues=[['goal-home','GOAL HORN','HOME','goal'],['goal-away','GOAL HORN','AWAY','goal'],['powerplay','POWER PLAY','HOME','powerplay'],['penalty','PENALTY','AWAY','penalty'],['pregame','PREGAME MIX','','pregame'],['ingame','IN-GAME MIX','','ingame'],['victory','VICTORY','HOME','victory']];
export const signature=e=>JSON.stringify([e.type,e.side,e.period,e.clock,e.text]);
export function reconcile(previous,incoming,types){
  const old=new Map(previous.map(e=>[e.id,e])),seen=new Set();
  const next=incoming.map(e=>{
    if(seen.has(e.id))throw new Error('Konfliktní nebo duplicitní události.');seen.add(e.id);
    const before=old.get(e.id),unchanged=before&&signature(before)===signature(e);
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
