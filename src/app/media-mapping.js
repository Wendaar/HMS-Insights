import {readFile} from 'node:fs/promises';
import {mediaKinds,mediaPath,mappingKey} from '../../public/media-mapping/model.js';
import {isGameId} from '../domain/game-summary.js';
export async function readMediaAssets(org){const catalog=JSON.parse(await readFile(new URL('../../public/media/catalog.json',import.meta.url),'utf8'));if(catalog.schemaVersion!==1||!Array.isArray(catalog.assets))throw new Error('Media catalog unavailable');return catalog.assets.filter(a=>(a.owner==='*'||a.owner===org)&&a.kind==='audio'&&mediaPath(a.path));}
export function mediaMapping(value,org,assets){
  if(value?.schemaVersion!==1||!Array.isArray(value.bindings)||value.bindings.length>200)throw new TypeError('Neplatná mapovací konfigurace.');
  const seen=new Set();return {schemaVersion:1,org,bindings:value.bindings.map(b=>{
    if(!['default','team','game','sponsor'].includes(b?.scope)||!['home','away','both'].includes(b.side)||!assets.some(a=>a.id===b.assetId)||typeof b.loop!=='boolean'||!Number.isFinite(b.volume)||b.volume<0||b.volume>1)throw new TypeError('Zkontrolujte zvuk a jeho hlasitost.');
    if(b.scope==='default'?b.targetId!=null:!isGameId(b.targetId))throw new TypeError('Chybí platné HMS ID cíle.');
    if(b.scope==='sponsor'?b.cue!=='ad':!mediaKinds.includes(b.cue))throw new TypeError('Neplatný typ zvuku.');
    if(['team','sponsor'].includes(b.scope)&&b.side!=='both')throw new TypeError('Tým a sponzor mají vlastní identitu, nikoli stranu zápasu.');
    const clean={scope:b.scope,targetId:b.scope==='default'?null:b.targetId.toLowerCase(),cue:b.cue,side:b.side,assetId:b.assetId,loop:b.loop,volume:b.volume};
    const key=mappingKey(clean);if(seen.has(key))throw new TypeError('Pro stejný povel je nastaveno více zvuků.');seen.add(key);return clean;
  })};
}
