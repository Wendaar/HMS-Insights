export const cues=[['pregame','PREGAME MIX'],['puckdrop','PUCK DROP'],['goal','GOAL'],['powerplay','POWER PLAY'],['ingame','IN GAME MIX'],['victory','VICTORY']].flatMap(([kind,label])=>['HOME','AWAY'].map(side=>[`${kind}-${side.toLowerCase()}`,label,side,kind]));
export function adCues(ads){return ads.map((ad,i)=>[`ad:${ad.id}`,`AD ${i+1}`,ad.name,`ad:${ad.id}`]);}
export function cueChannel(kind){return ['pregame','ingame','victory'].includes(kind)?'bed':'effect';}
export function finishAnnouncement(events,id,revision,status){const current=events.find(e=>e.id===id&&!e.withdrawn&&signature(e)===revision);if(current)current.status=status;return !!current;}
export function sponsorAds(catalog,org,teamIds=[],scope='organization'){
  if(catalog?.org!==org||!Array.isArray(catalog.items))return [];
  const lower=v=>String(v??'').toLowerCase(),teams=new Set(teamIds.filter(Boolean).map(lower)),seen=new Set();
  return catalog.items.filter(s=>{
    if(!/^[a-f0-9-]{36}$/i.test(s.id??'')||typeof s.name!=='string'||s.active===false||seen.has(lower(s.id)))return false;seen.add(lower(s.id));
    const links=[...(s.scopeRefs?.teamIds??[]),...(s.teams??[]),...(catalog.bindings??[]).filter(b=>lower(b.sponsorId)===lower(s.id)).map(b=>b.teamId)];
    return scope==='organization'||links.some(id=>teams.has(lower(id)));
  }).map(s=>({id:'hms:'+lower(s.id),name:s.name,sponsorId:lower(s.id),source:'HMS'}));
}
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
