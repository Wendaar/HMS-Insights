import {publicOrganizations} from '../src/app/organizations.js';
import {createPhotoArchive,photoArchiveEnabled} from '../src/app/photo-archive.js';
export async function checkGeneralArchive(env=process.env){
  if(env.VERCEL_ENV!=='preview' || !photoArchiveEnabled(env))throw Error('Preview required');
  const service=createPhotoArchive({env});
  for(const org of publicOrganizations(env)){
    if(!org.configured){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'hms_connection_not_configured'}));continue;}
    if(!env[`HMS_${org.code}_OPERATIONS_SECRET`]){console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'operations_secret_not_configured'}));continue;}
    try{const discovery=await service.discover(org.code,{}),catalog=await service.catalog(org.code),archive=await service.archive(org.code);console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,discovery,catalog:catalog.length,storedAlbums:catalog.filter(c=>c.imported).length,confirmedPlayers:archive.length,modelCalls:0}));}
    catch{console.log('PHOTO_ARCHIVE_GENERAL '+JSON.stringify({org:org.code,blocked:'live_hms_or_storage_check_failed',modelCalls:0}));}
  }
}
