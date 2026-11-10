import {publicOrganizations} from '../src/app/organizations.js';
import {createPhotoArchive,photoArchiveEnabled} from '../src/app/photo-archive.js';
export async function checkGeneralArchive(env=process.env){
  if(env.VERCEL_ENV!=='preview' || !photoArchiveEnabled(env))throw Error('Preview required');
  const service=createPhotoArchive({env});
  for(const org of publicOrganizations(env)){
    if(!org.configured){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'hms_connection_not_configured'}));continue;}
    if(!env[`HMS_${org.code}_OPERATIONS_SECRET`]){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'operations_secret_not_configured'}));continue;}
    try{let discovery=await service.discover(org.code,{}),games=discovery.games,albums=discovery.albums;
      for(let page=1;page<5 && discovery.hasMore;page++){discovery=await service.discover(org.code,{from:discovery.from,to:discovery.to,offset:discovery.nextOffset});games+=discovery.games;albums+=discovery.albums;}
      const catalog=await service.catalog(org.code),archive=await service.archive(org.code);console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,discovery,games,albums,catalog:catalog.length,storedAlbums:catalog.filter(c=>c.imported).length,confirmedPlayers:archive.length,modelCalls:0}));
      console.log('PHOTO_ARCHIVE_CATALOG '+JSON.stringify(catalog.filter(c=>c.albumUrl && !c.imported).slice(0,5).map(c=>({gameId:c.gameId,title:c.title,playedOn:c.playedOn,albumUrl:c.albumUrl,source:c.albumSource}))));
      const fresh=catalog.find(c=>!c.imported && c.albumUrl);if(fresh){const imported=await service.importCase(org.code,fresh.gameId,0,'preview-metadata-check');console.log('PHOTO_ARCHIVE_NEW_IMPORT '+JSON.stringify({org:org.code,gameId:fresh.gameId,title:imported.state.title,photos:imported.stats.total,players:imported.state.players.length,confirmed:imported.stats.confirmed,albumSource:imported.state.albumSource,modelCalls:0}));}
      const stored=catalog.find(c=>c.imported);if(stored){const before=await service.read(org.code,stored.gameId);try{const refreshed=await service.importCase(org.code,stored.gameId,before.revision,'preview-metadata-check');console.log('PHOTO_ARCHIVE_GENERAL_REFRESH '+JSON.stringify({org:org.code,gameId:stored.gameId,photos:refreshed.stats.total,albumSource:refreshed.state.albumSource,confirmedBefore:before.stats.confirmed,confirmedAfter:refreshed.stats.confirmed,modelCalls:0}));}catch(error){console.log('PHOTO_ARCHIVE_GENERAL_REFRESH '+JSON.stringify({org:org.code,status:error.status===409?'concurrent_edit':'metadata_refresh_failed',modelCalls:0}));}}
    }
    catch{console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'live_hms_or_storage_check_failed',modelCalls:0}));}
  }
}
