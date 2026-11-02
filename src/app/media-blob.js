import {toolStore} from '../infrastructure/tool-instances.js';
import {createHash,randomUUID} from 'node:crypto';
import {list} from '@vercel/blob';
import {generateClientTokenFromReadWriteToken} from '@vercel/blob/client';
import {mediaAssetPath,audioTypes,maxBlobBytes} from '../../public/media-mapping/model.js';
export const blobPrefix=(org,env)=>`hms-media/${env.VERCEL_ENV==='production'?'production':'preview'}/${org}/`;
export const blobReady=env=>!!env.BLOB_READ_WRITE_TOKEN;
export function uploadFile(value){
  if(!value||typeof value.name!=='string'||value.name.length>240||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>maxBlobBytes)throw new TypeError('Vyberte zvuk do 512 MB.');
  const ext=value.name.split('.').at(-1).toLowerCase(),type=audioTypes[ext];if(!type)throw new TypeError('Podporované formáty: MP3, WAV, OGG, M4A, AAC, FLAC a WEBM.');
  const name=value.name.replace(/\.[^.]*$/,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'audio';
  return {name:name+'.'+ext,bytes:value.bytes,type};
}
export function createMediaBlob({env=process.env,listImpl=list,tokenImpl=generateClientTokenFromReadWriteToken,now=Date.now,assetStore=toolStore({env,tool:env.VERCEL_ENV==='production'?'media-assets':'media-assets-preview'})}={}){
  const pending=new Map(),issued=new Map();
  return {
    ready:()=>blobReady(env),
    async assets(org,{refresh=false}={}){
      if(!blobReady(env))return [];
      if(!refresh){const row=await assetStore.get(org,'library');return (row?.draft?.assets??[]).filter(a=>a.owner===org&&a.source==='blob'&&mediaAssetPath(a.path)&&new URL(a.path).pathname.slice(1).startsWith(blobPrefix(org,env)));}
      if(pending.has(org))return pending.get(org);
      const work=(async()=>{for(let attempt=0;attempt<3;attempt++){const current=await assetStore.get(org,'library');const assets=[],prefix=blobPrefix(org,env),abortSignal=AbortSignal.timeout(7000);let cursor;
        for(let page=0;page<10;page++){const result=await listImpl({prefix,limit:100,cursor,abortSignal,token:env.BLOB_READ_WRITE_TOKEN});
          for(const b of result.blobs){const path=mediaAssetPath(b.url);if(!path||b.pathname!==new URL(path).pathname.slice(1)||!b.pathname.startsWith(prefix)||!Number.isSafeInteger(b.size)||b.size<1||b.size>maxBlobBytes)continue;
            assets.push({id:'blob:'+createHash('sha256').update(path).digest('hex').slice(0,24),title:b.pathname.split('/').at(-1).replace(/\.[^.]+$/,'').replaceAll('_',' '),path,owner:org,bytes:b.size,checksum:createHash('sha256').update(path).digest('hex'),kind:'audio',source:'blob'});}
          if(!result.hasMore){const saved=await assetStore.save(org,'library',{schemaVersion:1,assets},current?.revision??0,null);if(saved)return assets;break;}cursor=result.cursor;
        if(page===9)throw new Error('Blob catalog too large');}
        }throw new Error('Asset catalog conflict');})();pending.set(org,work);
      try{return await work;}finally{pending.delete(org);}
    },
    async authorize(org,value){
      if(!blobReady(env))throw new Error('Blob unavailable');const file=uploadFile(value);
      const times=(issued.get(org)??[]).filter(t=>t>now()-3600000);if(times.length>=20)throw new TypeError('Byl dosažen limit nových uploadů. Zkuste to za hodinu.');
      times.push(now());issued.set(org,times);
      const pathname=blobPrefix(org,env)+randomUUID()+'/'+file.name;
      const token=await tokenImpl({token:env.BLOB_READ_WRITE_TOKEN,pathname,allowedContentTypes:[file.type],maximumSizeInBytes:file.bytes,validUntil:now()+3600000,addRandomSuffix:false,allowOverwrite:false});
      return {pathname,token,contentType:file.type,maximumSizeInBytes:file.bytes};
    }
  };
}
