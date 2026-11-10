import {createPhotoArchive,readArchiveCases,photoArchiveEnabled} from '../src/app/photo-archive.js';
import {toolStore} from '../src/infrastructure/tool-instances.js';
export async function seedReviewArchive(env=process.env){
  if(!photoArchiveEnabled(env) || env.VERCEL_ENV!=='preview')throw Error('Review seed requires pilot Preview');
  const service=createPhotoArchive({env});if(!service.ready)throw Error('Preview archive database unavailable');
  for(const item of await readArchiveCases()){
    const current=await service.read(item.org,item.gameId);
    if(!current.needsImport){console.log('PHOTO_ARCHIVE_SEED '+JSON.stringify({gameId:item.gameId,alreadyImported:true,photos:current.stats.total}));continue;}
    const saved=await service.importCase(item.org,item.gameId,0,'pilot-initial-import');
    console.log('PHOTO_ARCHIVE_SEED '+JSON.stringify({gameId:item.gameId,photos:saved.stats.total,players:saved.state.players.length,persisted:true}));
  }
  // Persistence checks use a separate tool namespace and synthetic sporting IDs.
  const qaGame='00000000-0000-4000-8000-000000000061',qaPlayer='00000000-0000-4000-8000-000000000062';
  const qaStore=toolStore({env,tool:'photo-archive-persistence-qa-preview'});
  const options={env,store:qaStore,readCases:async()=>[{org:'PHM',gameId:qaGame,flickrAlbum:'https://flic.kr/s/qa'}],loadSource:async()=>({
    gameId:qaGame,title:'Persistence QA fixture',teams:[{teamId:'qa',name:'QA'}],players:[{playerId:qaPlayer,teamId:'qa',name:'QA fixture',jerseyNumber:'1'}],
    albumId:'qa',albumTotal:1,photos:[{id:'1'}]
  })};
  const qa=createPhotoArchive(options),previous=await qa.read('PHM',qaGame);
  let state=await qa.importCase('PHM',qaGame,previous.revision,'automated-fixture');
  state=await qa.decide('PHM',{gameId:qaGame,photoId:'1',decision:'assign',revision:state.revision,playerIds:[qaPlayer],reviewer:'Automated persistence fixture'},'automated-fixture');
  const reopened=createPhotoArchive(options),saved=await reopened.archive('PHM');
  if(saved.length!==1 || saved[0].photos.length!==1)throw Error('Persistence QA failed');
  state=await reopened.decide('PHM',{gameId:qaGame,photoId:'1',decision:'reset',revision:state.revision,playerIds:[],reviewer:'Automated persistence fixture'},'automated-fixture');
  if((await reopened.archive('PHM')).length)throw Error('Archive reset QA failed');
  console.log('PHOTO_ARCHIVE_REVIEW_QA '+JSON.stringify({durableSaveReadConfirmed:true,resetConfirmed:true,isolatedFixtureNamespace:true,finalRevision:state.revision}));
}
