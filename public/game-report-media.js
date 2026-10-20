// Only existing public HMS sporting assets; never arbitrary URLs from a payload.
export const mediaHosts=['prod-hms-wootera.s3.eu-central-1.amazonaws.com','hockeymanagementsystem.s3.amazonaws.com'];
export function sportingImage(value){
  if(typeof value!=='string')return null;
  try{const u=new URL(value.replace('[size]','cropped_md'));return u.protocol==='https:'&&mediaHosts.includes(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash?u.href:null;}catch{return null;}
}
export function flickrAlbum(value){
  if(typeof value!=='string')return null;
  if(/^https:\/\/www\.flickr\.com\/(photos\/[a-zA-Z0-9@_-]+\/albums\/\d+|gp\/[a-zA-Z0-9@_-]+\/[a-zA-Z0-9]+)\/?$/.test(value)||/^https:\/\/flic\.kr\/s\/[a-zA-Z0-9]+\/?$/.test(value))return value;
  return null;
}
export function youtubeVideo(value){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
    const id=u.hostname==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)?u.pathname==='/watch'?u.searchParams.get('v'):/^\/(live|embed|shorts)\//.test(u.pathname)?u.pathname.split('/')[2]:null:null;
    return /^[\w-]{11}$/.test(id??'')?`https://www.youtube.com/watch?v=${id}`:null;
  }catch{return null;}
}
