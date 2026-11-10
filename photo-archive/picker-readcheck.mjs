import {publicOrganizations} from '../src/app/organizations.js';
import {createPhotoArchive,photoArchiveEnabled} from '../src/app/photo-archive.js';
export async function checkGeneralArchive(env=process.env){
  if(env.VERCEL_ENV!=='preview' || !photoArchiveEnabled(env))throw Error('Preview required');
  const service=createPhotoArchive({env});
  for(const org of publicOrganizations(env)){
    if(!org.configured){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'hms_connection_not_configured'}));continue;}
    if(!env[`HMS_${org.code}_OPERATIONS_SECRET`]){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'operations_secret_not_configured'}));continue;}
    try{const discovery=await service.discover(org.code,{}),catalog=await service.catalog(org.code),archive=await service.archive(org.code);console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,discovery,catalog:catalog.length,storedAlbums:catalog.filter(c=>c.imported).length,confirmedPlayers:archive.length,modelCalls:0}));
      const stored=catalog.find(c=>c.imported);if(stored){const before=await service.read(org.code,stored.gameId);try{const refreshed=await service.importCase(org.code,stored.gameId,before.revision,'preview-metadata-check');console.log('PHOTO_ARCHIVE_GENERAL_REFRESH '+JSON.stringify({org:org.code,gameId:stored.gameId,photos:refreshed.stats.total,albumSource:refreshed.state.albumSource,confirmedBefore:before.stats.confirmed,confirmedAfter:refreshed.stats.confirmed,modelCalls:0}));}catch(error){console.log('PHOTO_ARCHIVE_GENERAL_REFRESH '+JSON.stringify({org:org.code,status:error.status===409?'concurrent_edit':'metadata_refresh_failed',modelCalls:0}));}}
    }
    catch{console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'live_hms_or_storage_check_failed',modelCalls:0}));}
  }
}
