import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaBlob,blobPrefix,uploadFile} from '../src/app/media-blob.js';
import {getPayloadFromClientToken} from '@vercel/blob/client';
import {mediaAssetPath,mediaAssetUrl,resolveMedia,maxBlobBytes} from '../public/media-mapping/model.js';
import {createMediaMappingHandler} from '../src/web/media-mapping-handler.js';
const token='vercel_blob_rw_teststore_'+ 'x'.repeat(40),env={BLOB_READ_WRITE_TOKEN:token,VERCEL_ENV:'production',HMS_PHM_OPERATIONS_SECRET:'operator'};
const path='hms-media/production/PHM/11111111-1111-4111-8111-111111111111/stadion_mix.mp3',url='https://teststore.public.blob.vercel-storage.com/'+path;
const entry={pathname:path,url,size:128*1024*1024};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;}});
const req=(action,body={},overrides={})=>({method:'POST',headers:{host:'hms.test',origin:'https://hms.test','content-type':'application/json',authorization:'Bearer operator'},query:{org:'PHM',action},body,...overrides});
const memory=()=>{const rows=new Map();return {async get(o,k){return rows.get(o+k)??null;},async save(o,k,d,r){const old=rows.get(o+k);if((old?.revision??0)!==r)return null;const row={draft:d,revision:r+1};rows.set(o+k,row);return row;}};};
const store={async get(){return null;}};
test('large-upload tokens are signed by the actual SDK and limited to one immutable org/environment file',async()=>{
 const blob=createMediaBlob({env});const result=await blob.authorize('PHM',{name:'Můj velký mix.mp3',bytes:128*1024*1024});assert.equal(result.contentType,'audio/mpeg');assert.match(result.pathname,/^hms-media\/production\/PHM\/[a-f0-9-]{36}\/Muj_velky_mix.mp3$/);
 const payload=getPayloadFromClientToken(result.token);assert.equal(payload.pathname,result.pathname);assert.equal(payload.maximumSizeInBytes,128*1024*1024);assert.equal(payload.allowOverwrite,false);assert.equal(payload.addRandomSuffix,false);assert.deepEqual(payload.allowedContentTypes,['audio/mpeg']);assert.doesNotMatch(result.token,new RegExp('x'.repeat(40)));
 assert.equal(blobPrefix('EUCHL',{VERCEL_ENV:'preview'}),'hms-media/preview/EUCHL/');assert.notEqual((await blob.authorize('PHM',{name:'Můj velký mix.mp3',bytes:128})).pathname,result.pathname);
});
test('512 MB bound, extensions, and filenames are enforced server-side',()=>{
 for(const value of [{name:'song.mp3',bytes:0},{name:'song.mp3',bytes:maxBlobBytes+1},{name:'song.exe',bytes:100},{name:'song.mp3',bytes:1.1}])assert.throws(()=>uploadFile(value),TypeError);
 assert.equal(uploadFile({name:'../../<script>.wav',bytes:maxBlobBytes}).name,'script.wav');
 for(const bad of ['https://evil.test/a.mp3',url+'?token=x',url+'#fragment',url.replace('production/PHM/','production/PHM/../EUCHL/'),url.replace('.public.','.private.'),url.replace('https:','http:')])assert.equal(mediaAssetPath(bad),null,bad);
 assert.equal(mediaAssetPath(url),url);
});
test('catalog persists provider-owned listing centrally and isolates organizations without repeated Blob list calls',async()=>{
 let calls=0,clock=0;const assetStore=memory(),blob=createMediaBlob({env,assetStore,now:()=>clock,listImpl:async options=>{calls++;assert.equal(options.token,token);return {blobs:[entry,{...entry,pathname:path.replace('/PHM/','/EUCHL/')}],hasMore:false};}});
 const first=await blob.assets('PHM',{refresh:true});assert.equal(first.length,1);assert.equal(first[0].bytes,128*1024*1024);assert.equal(first[0].owner,'PHM');assert.equal(mediaAssetUrl(first[0]),url);await blob.assets('PHM');assert.equal(calls,1);await blob.assets('PHM',{refresh:true});assert.equal(calls,2);clock=61000;await blob.assets('PHM');assert.equal(calls,2);assert.deepEqual(await blob.assets('EUCHL'),[]);const otherInstance=createMediaBlob({env,assetStore,listImpl(){throw Error('must use shared manifest');}});assert.deepEqual(await otherInstance.assets('PHM'),first);
 const config={org:'PHM',bindings:[{scope:'default',targetId:null,cue:'ingame',side:'both',assetId:first[0].id}]};assert.equal(resolveMedia(config,first,{org:'PHM',cue:'ingame',side:'home'}).asset.path,url);assert.equal(resolveMedia(config,[{...first[0],owner:'EUCHL'}],{org:'PHM',cue:'ingame',side:'home'}).asset,null);
});
test('upload endpoints reject missing/foreign credentials and origins before authorizing any Blob operation',async()=>{
 let calls=0;const blob={ready:()=>true,async authorize(){calls++;return {};},async assets(){return [];}};const h=createMediaMappingHandler({env,store,blob,readAssets:async()=>[]});
 for(const [request,status]of [[req('upload-token',{}, {headers:{}}),401],[req('upload-token',{}, {query:{action:'upload-token',org:'EUCHL'}}),503],[req('upload-token',{}, {headers:{...req('').headers,origin:'https://evil.test'}}),403],[req('upload-token',{}, {method:'GET'}),405]]){const r=res();await h(request,r);assert.equal(r.code,status);}
 assert.equal(calls,0);const r=res();await h(req('upload-token',{name:'x.mp3',bytes:125*1024*1024}),r);assert.equal(r.code,200);assert.equal(calls,1);
});
test('unconfigured and unavailable Blob never erase GitHub assets or stored published bindings',async()=>{
 const existing={schemaVersion:1,org:'PHM',bindings:[{assetId:'old',scope:'default',cue:'goal',side:'both'}]},github={id:'old',path:'/media/audio/phm/goal.mp3',owner:'PHM'};
 for(const blob of [{ready:()=>false,async assets(){return [];}},{ready:()=>true,async assets(){throw Error('secret provider failure');}}]){const h=createMediaMappingHandler({env,blob,store:{async get(){return {published:existing};}},readAssets:async()=>[github]});const r=res();await h(req('public',null,{method:'GET'}),r);assert.equal(r.code,200);assert.deepEqual(r.body.config,existing);assert.deepEqual(r.body.assets,[github]);assert.equal(r.body.blobAvailable,false);assert.doesNotMatch(JSON.stringify(r.body),/secret provider failure/);}
});
test('upload asset refresh changes only inventory, not draft/publication revision',async()=>{
 const blob={ready:()=>true,async assets(org,options){assert.equal(org,'PHM');assert.equal(options.refresh,true);return [entry];}};const h=createMediaMappingHandler({env,blob,store:{get(){throw Error('must not read or mutate mapping');}},readAssets:async()=>[]});const r=res();await h(req('refresh-assets',{}),r);assert.equal(r.code,200);assert.equal(r.body.assets.length,1);assert.equal(r.body.instance,undefined);
});
