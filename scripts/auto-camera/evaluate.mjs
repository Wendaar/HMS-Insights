import {readFile,writeFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {AutoDirector} from '../../public/virtual-camera/auto.js';
const directory=process.argv[2]??'artifacts/auto-camera';
const inventory=JSON.parse(await readFile(join(directory,'inventory.json'),'utf8')),summary=[];
for(const item of inventory){
 if(item.error)throw Error(item.error);
 const detections=JSON.parse(await readFile(join(directory,item.id+'.detections.json'),'utf8'));
 const director=new AutoDirector({x:.5,y:.5,zoom:1});let index=-1,previous=null,maxPanSpeed=0,maxZoomSpeed=0;const records=[],states={};let visible=0,total=0;
 for(let frame=0;frame<item.frames;frame++){
  const time=frame/item.fps;while(index+1<detections.length&&detections[index+1].time<=time)index++;
  const packet=index>=0&&time-detections[index].time<1.2?detections[index]:null;
  const result=director.update(packet,time);states[result.trackingState]=(states[result.trackingState]??0)+1;
  for(const t of result.tracks){total++;if(Math.abs(t.x-result.x)<=.5/result.zoom)visible++;}
  if(previous){maxPanSpeed=Math.max(maxPanSpeed,Math.abs(result.x-previous.x)*item.fps);maxZoomSpeed=Math.max(maxZoomSpeed,Math.abs(result.zoom-previous.zoom)*item.fps);}
  if(![result.x,result.y,result.zoom,result.confidence].every(Number.isFinite)||result.x-.5/result.zoom< -1e-9||result.x+.5/result.zoom>1+1e-9)throw Error('Invalid crop '+item.id);
  previous=result;records.push({time,...result});
 }
 await writeFile(join(directory,item.id+'.trajectory.json'),JSON.stringify(records));
 const latency=detections.map(d=>d.analysisMs).sort((a,b)=>a-b);
 summary.push({id:item.id,file:basename(item.file),duration:item.duration,frames:item.frames,samples:item.samples,meanTracks:item.meanTracks,meanAnalysisMs:item.meanAnalysisMs,p95AnalysisMs:latency[Math.floor(latency.length*.95)],maxPanSpeed,maxZoomSpeed,activeTrackVisibility:total?visible/total:null,states});
}
await writeFile(join(directory,'evaluation.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
