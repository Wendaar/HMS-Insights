import {isGameId} from './game-summary.js';
export const LIBRARY_BYTES=1800000;
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export function broadcastLibrary(value){
  if(!Array.isArray(value)||value.length>128||value.filter(item=>item?.kind!=='hms-sponsor').length>16||Buffer.byteLength(JSON.stringify(value))>LIBRARY_BYTES)throw new TypeError('Library size');
  const ids=new Set();
  return value.map(item=>{
    if(!isGameId(item?.id)||ids.has(item.id.toLowerCase())||!['cta','sponsor','hms-sponsor'].includes(item.kind)||!['PHM','EUCHL'].includes(item.org)
      ||!['organization','team','game'].includes(item.scope)||item.scope!=='organization'&&!isGameId(item.targetId)||typeof item.enabled!=='boolean')throw new TypeError('Library item');
    ids.add(item.id.toLowerCase());
    if(item.kind==='hms-sponsor'){
      if(!['team','game'].includes(item.scope)||!isGameId(item.sponsorId))throw new TypeError('Sponsor reference');
      return {id:item.id.toLowerCase(),kind:item.kind,org:item.org,scope:item.scope,targetId:item.targetId.toLowerCase(),sponsorId:item.sponsorId.toLowerCase(),enabled:item.enabled};
    }
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.image??'');
    if(!match||match[2].length>350000)throw new TypeError('Image size');
    const bytes=Buffer.from(match[2],'base64');
    if(bytes.toString('base64')!==match[2]||!(match[1]==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      ||match[1]==='jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255
      ||match[1]==='webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))throw new TypeError('Image type');
    let url='';if(item.url){const u=new URL(item.url);if(u.protocol!=='https:'||u.username||u.password||u.href.length>1000)throw new TypeError('Link');url=u.href;}
    const title=text(item.title,100);if(!title)throw new TypeError('Title');
    return {id:item.id.toLowerCase(),kind:item.kind,org:item.org,scope:item.scope,targetId:item.scope==='organization'?'':item.targetId.toLowerCase(),enabled:item.enabled,title,claim:text(item.claim,180),url,image:item.image};
  });
}
