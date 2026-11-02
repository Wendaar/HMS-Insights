export const mediaKinds=['pregame','puckdrop','goal','powerplay','ingame','victory'];
export const mediaLabels={pregame:'Pregame mix',puckdrop:'Puck drop',goal:'Goal song / horn',powerplay:'Power play',ingame:'In-game mix',victory:'Victory song',ad:'Reklama / znělka sponzora'};
export const mappingKey=b=>[b.scope,b.targetId??'',b.cue,b.side].join(':');
export const maxBlobBytes=512*1024*1024;
export const audioTypes={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm'};
export function mediaAssetPath(value){
  const local=mediaPath(value);if(local)return local;
  if(typeof value!=='string'||value.length>1200)return null;
  try{const u=new URL(value);if(u.href!==value)return null;if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||!/^[-a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname))return null;
    if(!/^\/hms-media\/(production|preview)\/[A-Z][A-Z0-9_]{1,23}\/[0-9a-f-]{36}\/[a-zA-Z0-9_-]{1,120}\.(mp3|wav|ogg|m4a|aac|flac|webm)$/.test(u.pathname))return null;return u.href;
  }catch{return null;}
}
export const mediaAssetUrl=asset=>asset?.source==='blob'?mediaAssetPath(asset.path):mediaPath(asset?.path)?asset.path+'?v='+encodeURIComponent(asset.checksum):null;
export function mediaPath(value){
  if(typeof value!=='string'||!value.startsWith('/media/audio/')||value.length>600||/[?#\\]/.test(value))return null;
  try{const parts=value.slice(1).split('/').map(decodeURIComponent);if(parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f\\/]/.test(p))||!['shared',...[parts[2]].filter(p=>/^[a-z][a-z0-9-]{1,39}$/.test(p))].includes(parts[2])||!(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(parts.at(-1))))return null;return '/'+parts.map(encodeURIComponent).join('/');}catch{return null;}
}
export function resolveMedia(config,assets,{org,gameId,homeId,awayId,cue,side}){
  if(config?.org!==org)return null;
  const team=side==='away'?awayId:homeId,eq=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();
  let candidates;
  if(cue.startsWith('ad:hms:'))candidates=[{scope:'sponsor',targetId:cue.slice(7),cue:'ad',side:'both'}];
  else candidates=[{scope:'game',targetId:gameId,cue,side},{scope:'game',targetId:gameId,cue,side:'both'},{scope:'team',targetId:team,cue,side:'both'},{scope:'default',targetId:null,cue,side},{scope:'default',targetId:null,cue,side:'both'}];
  for(const c of candidates){if(c.scope!=='default'&&!c.targetId)continue;const binding=config.bindings?.find(b=>b.scope===c.scope&&eq(b.targetId,c.targetId)&&b.cue===c.cue&&b.side===c.side);if(!binding)continue;
    const asset=assets.find(a=>a.id===binding.assetId&&(a.owner==='*'||a.owner===org)&&mediaAssetPath(a.path));return {binding,asset:asset??null,source:c.scope};}
  return null;
}
