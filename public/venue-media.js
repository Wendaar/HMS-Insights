import {sportingImage} from './game-report-media.js';
export function flickrPhoto(value){
 try{const u=new URL(value),path=/^(\/photos\/[a-zA-Z0-9@_-]+\/\d+)(?:\/in\/dateposted)?\/?$/.exec(u.pathname);return u.protocol==='https:'&&['flickr.com','www.flickr.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&path?'https://www.flickr.com'+path[1]+'/':null;}catch{return null;}
}
export function flickrImage(value){
 try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='live.staticflickr.com'||/^farm\d+\.staticflickr\.com$/.test(u.hostname))&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/\d+\/\d+_[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)?\.(jpg|jpeg|png|webp)$/.test(u.pathname)?u.href:null;}catch{return null;}
}
export function venueBackground(value){
 if(typeof value!=='string'||value.length>2048)return null;
 const known=sportingImage(value)||flickrImage(value)||flickrPhoto(value);if(known)return known;
 try{const u=new URL(value),h=u.hostname;return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&h.includes('.')&&!/^\d/.test(h)&&!h.includes(':')&&!/\.(local|internal|localhost|test)$/.test(h)&&/\.(png|jpe?g|webp)$/i.test(u.pathname)?u.href:null;}catch{return null;}
}
