import {createPhotoArchive,readArchiveCases,photoArchiveEnabled} from '../src/app/photo-archive.js';
import {createPhotoArchiveHandler} from '../src/web/photo-archive-handler.js';
// Explicit marked Preview build only. Exercises the authenticated handlers and real durable cache.
export async function smokeAlbumAnalysis({env=process.env}={}){
  if(env.VERCEL_ENV!=='preview' || !photoArchiveEnabled(env))throw Error('Preview pilot required');
  const service=createPhotoArchive({env}),handler=createPhotoArchiveHandler({env,service});
  const [item]=await readArchiveCases();
  async function call(action,body){
    const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',query:{org:'phm',action},headers:{host:'preview.test','content-type':'application/json',authorization:`Bearer ${env.HMS_PHM_OPERATIONS_SECRET}`},body},res);
    if(res.code!==200)throw Error(`Album AI smoke ${action} HTTP ${res.code}`);return res.body;
  }
  let v=await service.read('PHM',item.gameId);
  v=await call('analyze-start',{gameId:item.gameId,revision:v.revision,limit:3});
  let requests=0;while(v.state.analysisJob.status==='running' && requests<3){v=await call('analyze-next',{gameId:item.gameId,revision:v.revision,jobId:v.state.analysisJob.id});requests++;}
  const reopened=await createPhotoArchive({env}).read('PHM',item.gameId);
  const targets=v.state.analysisJob.targets;
  const results=targets.map(id=>reopened.state.photos.find(p=>p.id===id)).map(p=>({photoId:p.id,status:p.analysis?.status,candidateCount:p.suggestions.reduce((n,s)=>n+s.candidates.length,0),usage:p.analysis?.usage,error:p.analysis?.error}));
  console.log('PHOTO_ARCHIVE_ALBUM_AI '+JSON.stringify({requests,status:v.state.analysisJob.status,persisted:targets.every(id=>reopened.state.analyses?.[id]?.status==='complete'),results}));
}
