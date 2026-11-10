import {createPhotoArchive} from './photo-archive.js';
export async function validatePlayerPhotoChoices(org,config,options={}){
  for(const [id,choice] of Object.entries(config.photoChoices || {}))if(choice.source==='archive'){
    const playerId=id.split('|')[0],players=await(options.playerPhotos ?? ((org,id)=>createPhotoArchive({env:options.env}).archive(org,id)))(org,playerId);
    if(!players.flatMap(p=>p.photos).some(p=>p.id===choice.photoId && [p.previewUrl,p.thumbnailUrl].includes(choice.url)))throw new TypeError('Archive photo is not confirmed for this player/organization');
  }
}
