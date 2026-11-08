import {readFile} from 'node:fs/promises';
import {fetchLineup} from './lineup.mjs';
import {fetchAlbum} from './flickr.mjs';

// Build-log diagnostics only: no tokens, roster identities, image URLs or files.
export async function runPreviewCheck({env=process.env,fetchImpl=fetch,log=console.log}={}) {
  if (env.VERCEL_ENV !== 'preview') throw new Error('Live check requires Vercel Preview');
  const flickrEnv={FLICKR_API_KEY:env.FLICKR_API_KEY || env.FLICKT_API_KEY};
  const safeError=err=>{
    let message=String(err.message || 'Read-only check failed');
    for(const secret of [env.HMS_API_TOKEN,flickrEnv.FLICKR_API_KEY]) if(secret) message=message.replaceAll(secret,'[redacted]');
    return message;
  };
  const cases=JSON.parse(await readFile(new URL('./pilot-cases.json',import.meta.url),'utf8'));
  const summary=[];
  log('PHOTO_ARCHIVE_CONFIG '+JSON.stringify({hmsTokenAvailable:Boolean(env.HMS_API_TOKEN),flickrKeyAvailable:Boolean(flickrEnv.FLICKR_API_KEY),legacyKeyAliasUsed:!env.FLICKR_API_KEY && Boolean(env.FLICKT_API_KEY)}));
  for(const [index,item] of cases.entries()) {
    const result={case:index+1,gameId:item.gameId};
    try {
      const lineup=await fetchLineup(item.gameId,{env,fetchImpl});
      result.hms={ok:true,players:lineup.players.length,withNumbers:lineup.players.filter(p=>p.jerseyNumber!==null).length};
    } catch(err) {result.hms={ok:false,error:safeError(err)};}
    try {
      const album=await fetchAlbum(item.flickrAlbum,{env:flickrEnv,limit:3,fetchImpl});
      const previews=album.photos.filter(p=>p.previewUrl);
      const checks=[];
      for(const photo of previews.slice(0,1)) {
        const imageUrl=new URL(photo.previewUrl);
        if(imageUrl.protocol!=='https:' || !/^(?:live\.staticflickr\.com|farm\d+\.staticflickr\.com)$/.test(imageUrl.hostname) || imageUrl.port || imageUrl.username || imageUrl.password) throw Error('Unexpected preview host');
        const response=await fetchImpl(imageUrl,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});
        checks.push({photoId:photo.id,status:response.status,imageContentType:response.headers.get('content-type')?.startsWith('image/') || false});
      }
      result.flickr={ok:true,albumId:album.photosetId,total:album.total,sampled:album.photos.length,withPreviews:previews.length,previewChecks:checks};
    } catch(err) {result.flickr={ok:false,error:safeError(err)};}
    summary.push(result);
    log('PHOTO_ARCHIVE_RESULT '+JSON.stringify(result));
  }
  return summary;
}
