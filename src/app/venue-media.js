import {venueBackground,flickrPhoto,flickrImage} from '../../public/venue-media.js';
const cache=new Map(),pending=new Map();
export async function resolveVenueBackground(value,options={}){
 const source=venueBackground(value);if(!source)return null;if(!flickrPhoto(source))return source;
 if(!options.fetchImpl&&cache.get(source)?.until>Date.now())return cache.get(source).value;
 if(pending.has(source))return pending.get(source);if(pending.size>=8)return null;
 const task=(async()=>{let image=null;try{
  const url=new URL('https://www.flickr.com/services/oembed/');url.searchParams.set('url',source);url.searchParams.set('format','json');url.searchParams.set('maxwidth','1600');
  const r=await(options.fetchImpl??fetch)(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(4000),headers:{accept:'application/json'}});
  if(!r.ok||Number(r.headers.get('content-length'))>32768){await r.body?.cancel();throw Error('oEmbed unavailable');}
  const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>32768){await reader.cancel();throw Error('Large oEmbed');}chunks.push(Buffer.from(next.value));}}finally{reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(data.type==='photo')image=flickrImage(data.url)??flickrImage(data.thumbnail_url);
 }catch{/* Optional photo never blocks the sporting preview. */}
 if(!options.fetchImpl){if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(source,{value:image,until:Date.now()+(image?21600000:60000)});}return image;})();
 pending.set(source,task);try{return await task;}finally{pending.delete(source);}
}
