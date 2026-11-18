import * as ort from './runtime/ort.webgpu.min.mjs';
import {decode,suppress,jerseyEvidence,BrowserTracker} from './detector-core.js';
let session,model='nano',backend='CPU',tracker=new BrowserTracker();
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('./runtime/',import.meta.url).href;
async function init(quality){
 if(session)await session.release();session=null;tracker.reset();
 let gpuError;
 if(quality!=='cpu'&&self.navigator.gpu){try{model=quality==='quality'?'tiny':'nano';session=await ort.InferenceSession.create(new URL('./runtime/yolox_'+model+'.onnx',import.meta.url).href,{executionProviders:['webgpu']});backend='GPU';}catch(error){gpuError=error;session=null;}}
 if(!session){model='nano';backend='CPU';try{session=await ort.InferenceSession.create(new URL('./runtime/yolox_nano.onnx',import.meta.url).href,{executionProviders:['wasm']});}catch(error){throw Error(String(gpuError?.message||error.message||error));}}
 return {model,backend};
}
async function analyze(bitmap,time,reset){
 const started=performance.now();if(reset)tracker.reset();const width=bitmap.width,height=bitmap.height,canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
 const pixels=ctx.getImageData(0,0,width,height).data,tile=new OffscreenCanvas(416,416),tc=tile.getContext('2d',{willReadFrequently:true});let boxes=[];
 for(const [left,right] of [[0,.45],[.275,.725],[.55,1]]){
  const x0=Math.floor(left*width),y0=Math.floor(.25*height),w=Math.floor(right*width)-x0,h=Math.floor(.82*height)-y0,ratio=Math.min(416/w,416/h);
  tc.fillStyle='rgb(114,114,114)';tc.fillRect(0,0,416,416);tc.drawImage(canvas,x0,y0,w,h,0,0,Math.floor(w*ratio),Math.floor(h*ratio));
  const rgba=tc.getImageData(0,0,416,416).data,data=new Float32Array(3*416*416),n=416*416;
  for(let p=0;p<n;p++){data[p]=rgba[p*4+2];data[n+p]=rgba[p*4+1];data[n*2+p]=rgba[p*4];}
  const input=new ort.Tensor('float32',data,[1,3,416,416]),result=await session.run({[session.inputNames[0]]:input});const output=result[session.outputNames[0]];
  boxes.push(...decode(output.data,output.dims,{width,height,x0,y0,ratio}));input.dispose();for(const value of Object.values(result))value.dispose();
 }
 const detections=suppress(boxes).map(d=>({...d,evidence:jerseyEvidence(pixels,width,height,d.box)}));
 return {time,width,height,tracks:tracker.update(detections,time,width,height),analysisMs:performance.now()-started,detector:'Web YOLOX-'+model+' / '+backend,engine:'browser',model,backend};
}
self.onmessage=async({data})=>{try{const result=data.action==='init'?await init(data.quality):await analyze(data.bitmap,data.time,data.reset);self.postMessage({id:data.id,result});}catch(error){data.bitmap?.close();self.postMessage({id:data.id,error:String(error.message||error)});}};
