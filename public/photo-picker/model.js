import {sportingImage} from '../game-report-media.js';
import {flickrImage} from '../venue-media.js';
export function photoChoice(value){
  if(!value || value.source==='hms')return {source:'hms'};
  if(value.source==='archive' && /^\d+$/.test(value.photoId || '') && flickrImage(value.url))return {source:'archive',photoId:value.photoId,url:flickrImage(value.url)};
  if(value.source==='upload' && typeof value.url==='string' && value.url.length<=180000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value.url))return {source:'upload',url:value.url};
  throw new TypeError('Neplatná fotografie.');
}
export function selectedPhotoUrl(choice,hmsUrl){
  const valid=photoChoice(choice);return valid.source==='hms'?sportingImage(hmsUrl):valid.url;
}
