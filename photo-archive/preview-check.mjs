import {readFile} from 'node:fs/promises';
import {fetchLineup} from './lineup.mjs';
import {fetchAlbum} from './flickr.mjs';
import {analyzePhoto} from './vision.mjs';
import {suggestPlayers} from './matcher.mjs';

// Build-log diagnostics only: no tokens, roster identities, image URLs or files.
export async function runPreviewCheck({env=process.env,fetchImpl=fetch,log=console.log,analyze=false,expectedModel=null}={}) {
  if (env.VERCEL_ENV !== 'preview') throw new Error('Live check requires Vercel Preview');
  const flickrEnv={FLICKR_API_KEY:env.FLICKR_API_KEY || env.FLICKT_API_KEY};
  const safeError=err=>{
    let message=String(err.message || 'Read-only check failed');
    for(const secret of [env.HMS_API_TOKEN,flickrEnv.FLICKR_API_KEY,env.OPENAI_API_KEY]) if(secret) message=message.replaceAll(secret,'[redacted]');
    return message;
  };
  const cases=JSON.parse(await readFile(new URL('./pilot-cases.json',import.meta.url),'utf8'));
  const summary=[];
  let visionCalls=0,visionBlocked=null;
  log('PHOTO_ARCHIVE_CONFIG '+JSON.stringify({hmsTokenAvailable:Boolean(env.HMS_API_TOKEN),flickrKeyAvailable:Boolean(flickrEnv.FLICKR_API_KEY),legacyKeyAliasUsed:!env.FLICKR_API_KEY && Boolean(env.FLICKT_API_KEY),visionRequested:analyze,openaiKeyAvailable:Boolean(env.OPENAI_API_KEY),visionModel:env.PHOTO_VISION_MODEL || null}));
  for(const [index,item] of cases.entries()) {
    const result={case:index+1,gameId:item.gameId};
    let lineup,album;
    try {
      lineup=await fetchLineup(item.gameId,{env,fetchImpl});
      result.hms={ok:true,players:lineup.players.length,withNumbers:lineup.players.filter(p=>p.jerseyNumber!==null).length};
    } catch(err) {result.hms={ok:false,error:safeError(err)};}
    try {
      album=await fetchAlbum(item.flickrAlbum,{env:flickrEnv,limit:3,fetchImpl});
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
    if(analyze) {
      const photo=album?.photos.find(p=>p.previewUrl);
      if(visionBlocked) result.vision={ok:false,attempted:false,error:visionBlocked};
      else if(visionCalls>=3) result.vision={ok:false,attempted:false,error:'Global 3-image test budget reached'};
      else if(!env.OPENAI_API_KEY || !env.PHOTO_VISION_MODEL) result.vision={ok:false,attempted:false,error:'Missing OPENAI_API_KEY or PHOTO_VISION_MODEL'};
      else if(expectedModel && env.PHOTO_VISION_MODEL!==expectedModel) result.vision={ok:false,attempted:false,error:'Configured model differs from the requested low-cost test model'};
      else if(!lineup || !photo) result.vision={ok:false,attempted:false,error:'Blocked by missing lineup or photo preview'};
      else {
        visionCalls++;
        try {
          const visual=await analyzePhoto(photo.previewUrl,{env,fetchImpl});
          const suggestions=suggestPlayers(lineup.players,visual.observations);
          result.vision={ok:true,attempted:true,photoId:photo.id,model:visual.model,responseId:visual.responseId,usage:visual.usage,
            observations:visual.observations.map((o,i)=>({observedNumber:o.observedNumber,eligibleNumber:o.jerseyNumber,confidence:o.confidence,
              status:suggestions[i].status,candidateCount:suggestions[i].candidates.length,reason:suggestions[i].reason})),requiresHumanReview:true};
        } catch(err) {
          result.vision={ok:false,attempted:true,photoId:photo.id,error:safeError(err)};
          if(/Vision API HTTP (401|403|429)/.test(result.vision.error)) visionBlocked='Further calls blocked after '+result.vision.error;
        }
      }
    }
    summary.push(result);
    log('PHOTO_ARCHIVE_RESULT '+JSON.stringify(result));
  }
  log('PHOTO_ARCHIVE_TOTAL '+JSON.stringify({visionCalls,visionSucceeded:summary.filter(r=>r.vision?.ok).length}));
  return summary;
}
