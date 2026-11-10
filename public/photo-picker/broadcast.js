import {photoChoice,selectedPhotoUrl} from './model.js';
export function broadcastPhotoChoices(value={}){
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length>6)throw new TypeError('Nejvýše šest vlastních fotografií na zápas.');
  return Object.fromEntries(Object.entries(value).map(([id,choice])=>{if(!/^[a-f0-9-]{36}$/i.test(id))throw new TypeError('Invalid player');return [id.toLowerCase(),photoChoice(choice)];}));
}
export function applyBroadcastPhotos(game,choices){
  if(!game)return game;const validated=broadcastPhotoChoices(choices),copy=structuredClone(game);
  function visit(value,depth=0){if(!value || typeof value!=='object' || depth>12)return;if(typeof value.id==='string' && validated[value.id.toLowerCase()])value.imageUrl=selectedPhotoUrl(validated[value.id.toLowerCase()],value.imageUrl);for(const item of Object.values(value))if(typeof item==='object')visit(item,depth+1);}
  visit(copy);return copy;
}
