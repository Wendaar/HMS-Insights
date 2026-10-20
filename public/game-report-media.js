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
