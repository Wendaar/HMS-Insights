import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),root=new URL('../../',import.meta.url),output=new URL('../../public/virtual-camera/runtime/',import.meta.url);
export const models={
 nano:{file:'yolox_nano.onnx',sha:'c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d',cache:'yoloxModel.onnx'},
 tiny:{file:'yolox_tiny.onnx',sha:'427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7',cache:'yoloxTiny.onnx'}
};
export async function buildCameraAssets(){
 await mkdir(output,{recursive:true});const dist=dirname(require.resolve('onnxruntime-web'));
 for(const name of ['ort.webgpu.min.mjs','ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm','ort-wasm-simd-threaded.jspi.mjs','ort-wasm-simd-threaded.jspi.wasm'])await copyFile(join(dist,name),new URL(name,output));
 for(const name of ['ONNXRUNTIME-LICENSE.txt','ONNXRUNTIME-ThirdPartyNotices.txt','YOLOX-APACHE-2.0.txt'])await copyFile(new URL('../../docs/auto-camera-licenses/'+name,import.meta.url),new URL(name,output));
 for(const model of Object.values(models)){
  let bytes;for(const path of [new URL(model.file,output),new URL('../auto-camera-research/'+model.cache,root)]){try{const value=await readFile(path);if(createHash('sha256').update(value).digest('hex')===model.sha){bytes=value;break;}}catch{}}
  if(!bytes){const response=await fetch('https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/'+model.file,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Model download HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
  if(createHash('sha256').update(bytes).digest('hex')!==model.sha)throw Error('Unexpected model SHA256: '+model.file);
  await writeFile(new URL(model.file,output),bytes);
 }
 await writeFile(new URL('manifest.json',output),JSON.stringify({runtime:JSON.parse(await readFile(join(dist,'../package.json'),'utf8')).version,models},null,2));
 console.log('Browser camera runtime and verified models ready.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildCameraAssets();
