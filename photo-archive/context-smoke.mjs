import {createPhotoArchive,readArchiveCases,photoArchiveEnabled} from '../src/app/photo-archive.js';
export async function smokeJerseyContext({env=process.env}={}){
  if(env.VERCEL_ENV!=='preview' || !photoArchiveEnabled(env))throw Error('Preview pilot required');
  const service=createPhotoArchive({env}),cases=await readArchiveCases();let first;
  for(const item of cases){const old=await service.read('PHM',item.gameId),v=await service.importCase('PHM',item.gameId,old.revision,'context-v2-import');
    console.log('PHOTO_ARCHIVE_JERSEYS '+JSON.stringify({gameId:item.gameId,teams:v.state.teams.map(t=>({name:t.name,color:t.jerseyColor,family:t.jerseyFamily,source:t.jerseySource})),goalies:v.state.players.filter(p=>p.role==='goalie').length,unknownRoles:v.state.players.filter(p=>p.role==='unknown').length}));
    first ||= v;
  }
  const targets=['IMG_7785','IMG_7798'].map(title=>first.state.photos.find(p=>p.title.toUpperCase().includes(title)));
  if(targets.some(p=>!p)){console.log('PHOTO_ARCHIVE_CONTEXT_SMOKE '+JSON.stringify({blocked:'Requested screenshot titles not found',calls:0}));return;}
  let v=first;
  for(const photo of targets){
    v=await service.startAnalysis('PHM',{gameId:first.gameId,revision:v.revision,photoId:photo.id,limit:1,upgradeOld:true});
    const queued=v.state.analysisJob.targets.length;
    if(queued)v=await service.nextAnalysis('PHM',{gameId:first.gameId,revision:v.revision,jobId:v.state.analysisJob.id});
    const saved=await createPhotoArchive({env}).read('PHM',first.gameId),p=saved.state.photos.find(p=>p.id===photo.id);
    console.log('PHOTO_ARCHIVE_CONTEXT_SMOKE '+JSON.stringify({photoId:p.id,title:p.title,calls:queued,persisted:p.analysis?.analysisVersion===2,status:p.analysis?.status,error:p.analysis?.error,usage:p.analysis?.usage,
      observations:p.observations.map((o,i)=>({number:o.observedNumber,confidence:o.confidence,color:o.jerseyColor,colorConfidence:o.jerseyColorConfidence,role:o.role,roleConfidence:o.roleConfidence,candidates:p.suggestions[i].candidates.map(c=>({number:c.jerseyNumber,team:saved.state.teams.find(t=>t.teamId===c.teamId)?.name,role:c.role})),tentative:p.suggestions[i].tentative}))}));
    if(p.analysis?.status==='failed')break;v=saved;
  }
}
