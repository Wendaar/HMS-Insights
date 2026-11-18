import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const before=process.argv[2]??'artifacts/auto-camera-baseline-a692b16',after=process.argv[3]??'artifacts/auto-camera-v2';
const read=async(path)=>JSON.parse(await readFile(path,'utf8'));
const inventory=await read(join(after,'inventory.json')),results=[];
// Same NEW observations are used to score both trajectories; never compare each
// version against its own (different) detector population. These are proxies,
// not human ground truth, event accuracy, or puck possession measurements.
for(const item of inventory){
 const old=await read(join(before,item.id+'.trajectory.json')),updated=await read(join(after,item.id+'.trajectory.json')),observations=await read(join(after,item.id+'.detections.json'));
 if(old.length!==updated.length||old.length!==item.frames)throw Error('Frame count mismatch');
 const metric=records=>{
  let count=0,visible=0,nearestOfficial=0,officialOpportunities=0,zoom=0,breakawayFrames=0;
  for(const p of observations){
   const r=records[Math.round(p.time*item.fps)],usable=p.tracks.filter(t=>t.source!=='colour_motion'&&t.age>=2&&t.confidence>=.18&&t.y>=.34&&t.y<=.73&&t.x>=.08&&t.x<=.94);
   const skaters=usable.filter(t=>(t.playerScore??0)>.55&&(t.officialScore??0)<.3);
   const refs=usable.filter(t=>(t.officialScore??0)>=.55&&(t.playerScore??0)<.35);
   for(const t of skaters){count++;if(Math.abs(t.x-r.x)<=r.cropWidth/2&&Math.abs(t.y-r.y)<=r.cropHeight/2)visible++;}
   const nearestSkater=Math.min(...skaters.map(t=>Math.abs(t.x-r.targetX))),nearestRef=Math.min(...refs.map(t=>Math.abs(t.x-r.targetX)));
   if(skaters.length&&refs.length){officialOpportunities++;if(nearestRef+.04<nearestSkater)nearestOfficial++;}
  }
  for(const r of records){zoom+=r.zoom;if(r.trackingState.startsWith('BREAKAWAY'))breakawayFrames++;}
  return {colouredSkaterObservations:count,colouredSkaterVisibility:count?visible/count:null,refereeAttractionOpportunities:officialOpportunities,refereeAttractionSamples:nearestOfficial,refereeAttractionRate:officialOpportunities?nearestOfficial/officialOpportunities:null,meanZoom:zoom/records.length,breakawaySeconds:breakawayFrames/item.fps};
 };
 results.push({id:item.id,file:item.file,before:metric(old),after:metric(updated),analysisMs:item.meanAnalysisMs});
}
await writeFile(join(after,'comparison.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
