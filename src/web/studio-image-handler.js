import { mediaHosts } from '../../public/game-report-media.js';
const MAX_BYTES=8*1024*1024;
let active=0;
export function studioAssetUrl(value) {
  if(typeof value!=='string'||value.length>2048)throw new TypeError('Neplatný obrázek.');
  const u=new URL(value.replace('[size]','cropped_md'));
  // Fixed, Amazon-owned DNS names only. No arbitrary hosts, ports, auth, query
  // strings, redirects or forwarding of HMS credentials to object storage.
  if(u.protocol!=='https:'||!mediaHosts.includes(u.hostname)||u.port||u.username||u.password||u.search||u.hash)throw new TypeError('Nepovolený zdroj obrázku.');
  return u;
}
function imageType(b) {
  if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
  if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
export function createStudioImageHandler(options={}) {
  return async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Pouze čtení.'});}
    let counted=false;
    try {
      const url=studioAssetUrl(req.query?.url);
      if(active>=16)throw new Error('Busy');active++;counted=true;
      const refresh=req.query?.refresh==='1';
      const r=await (options.fetchImpl??fetch)(url,{...(refresh?{cache:'no-store'}:{}),redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(8000),headers:{accept:'image/png,image/jpeg,image/webp',...(refresh?{'cache-control':'no-cache'}:{})}});
      if(!r.ok||r.status>=300||Number(r.headers.get('content-length'))>MAX_BYTES){await r.body?.cancel();throw new Error('Unavailable');}
      const reader=r.body?.getReader();if(!reader)throw new Error('Unavailable');
      const chunks=[];let size=0;
      try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw new Error('Too large');chunks.push(Buffer.from(value));}}
      catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
      const bytes=Buffer.concat(chunks),type=imageType(bytes);if(!type)throw new Error('Not a raster image');
      res.setHeader('Content-Type',type);res.setHeader('Cache-Control',refresh?'no-store':'public, max-age=3600, s-maxage=86400');
      return res.status(200).send(bytes);
    }catch(e){return res.status(e instanceof TypeError?400:502).json({error:'HMS obrázek není dostupný.'});}
    finally{if(counted)active--;}
  };
}
