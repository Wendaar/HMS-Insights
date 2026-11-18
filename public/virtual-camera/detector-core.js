const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function iou(a,b){const w=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),h=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),area=w*h;return area/Math.max(1e-9,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-area);}
export function suppress(boxes){const kept=[];for(const d of boxes.sort((a,b)=>b.confidence-a.confidence).slice(0,240)){if(kept.every(k=>iou(k.box,d.box)<.45))kept.push(d);if(kept.length>=60)break;}return kept;}
export function decode(data,dims,{width,height,x0,y0,ratio}){
 if(dims.length!==3||dims[1]!==3549||dims[2]!==85)throw Error('Nepodporovaný formát modelu kamery');
 const boxes=[];let row=0;
 for(const stride of [8,16,32])for(let gy=0;gy<416/stride;gy++)for(let gx=0;gx<416/stride;gx++,row++){
  const at=row*85,confidence=data[at+4]*data[at+5];if(confidence<.12)continue;
  const cx=(data[at]+gx)*stride/ratio+x0,cy=(data[at+1]+gy)*stride/ratio+y0;
  const bw=Math.exp(clamp(data[at+2],-10,10))*stride/ratio,bh=Math.exp(clamp(data[at+3],-10,10))*stride/ratio;
  const box=[clamp(cx-bw/2,0,width),clamp(cy-bh/2,0,height),clamp(cx+bw/2,0,width),clamp(cy+bh/2,0,height)];
  if(box.every(Number.isFinite)&&box[2]>box[0]&&box[3]>box[1])boxes.push({box,confidence});
 }
 return boxes;
}
const percentile=(a,q)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor((s.length-1)*q))]??0;};
export function jerseyEvidence(pixels,width,height,box){
 const bw=box[2]-box[0],bh=box[3]-box[1],x0=Math.max(0,Math.floor(box[0]+.15*bw)),x1=Math.min(width,Math.floor(box[2]-.15*bw));
 const y0=Math.max(0,Math.floor(box[1]+.17*bh)),y1=Math.min(height,Math.floor(box[1]+.62*bh));
 if(x1-x0<7||y1-y0<8)return {official:0,player:0};
 const columns=[],rows=[];let coloured=0,dark=0,light=0,total=0,dx=0,dy=0,nx=0,ny=0;
 for(let y=y0;y<y1;y++){const values=[];for(let x=x0;x<x1;x++){
  const at=(y*width+x)*4,r=pixels[at],g=pixels[at+1],b=pixels[at+2],max=Math.max(r,g,b),min=Math.min(r,g,b),gray=.299*r+.587*g+.114*b;
  if(max>45&&(max-min)/Math.max(1,max)>65/255)coloured++;if(gray<95)dark++;if(gray>155)light++;total++;
  (columns[x-x0]??=[]).push(gray);values.push(gray);
  if(x>x0){dx+=Math.abs(gray-values[values.length-2]);nx++;}if(y>y0){dy+=Math.abs(gray-rows[y-y0-1][x-x0]);ny++;}
 }rows.push(values);}
 const profile=columns.map(c=>percentile(c,.5)),mid=(percentile(profile,.1)+percentile(profile,.9))/2,signs=profile.filter(x=>Math.abs(x-mid)>10).map(x=>Math.sign(x-mid));
 let transitions=0;for(let i=1;i<signs.length;i++)if(signs[i]!==signs[i-1])transitions++;
 const mean=profile.reduce((a,b)=>a+b,0)/profile.length,std=Math.sqrt(profile.reduce((a,b)=>a+(b-mean)**2,0)/profile.length),fraction=coloured/total;
 const official=clamp((transitions-2)/3,0,1)*clamp((std-14)/24,0,1)*Math.min(1,dark/total/.13,light/total/.13)*(.55+.45*clamp(((dx/Math.max(nx,1))/(dy/Math.max(ny,1)+1)-.8)/.9,0,1))*clamp(1-fraction/.25,0,1);
 return {official,player:clamp((fraction-.08)/.35,0,1)};
}
// Portable browser tracker, not Python ByteTrack. Match one-to-one against a
// bounded motion prediction and appearance; never emit missed-frame guesses.
export class BrowserTracker {
 constructor(){this.reset();}
 reset(){this.tracks=new Map();this.next=1;}
 update(detections,time,width,height){
  detections=detections.filter(d=>d.confidence>=.18);
  const pairs=[];
  for(let i=0;i<detections.length;i++){const d=detections[i],x=(d.box[0]+d.box[2])/2/width,y=d.box[3]/height;
   for(const [id,t] of this.tracks){const dt=time-t.at;if(dt<=0||dt>1.5)continue;const distance=Math.hypot(x-(t.x+t.vx*Math.min(dt,.7)),1.4*(y-(t.y+t.vy*Math.min(dt,.7))));
    if(distance<.12)pairs.push({i,id,cost:distance/.12+.35*(1-iou(t.pixelBox,d.box))+.2*Math.abs(t.playerScore-d.evidence.player)});
   }
  }
  const assignments=new Map(),used=new Set();for(const p of pairs.sort((a,b)=>a.cost-b.cost))if(!assignments.has(p.i)&&!used.has(p.id)){assignments.set(p.i,p.id);used.add(p.id);}
  const output=[],current=new Map();
  detections.forEach((d,i)=>{
   if(d.confidence<.18)return;const id=assignments.get(i)??this.next++,old=this.tracks.get(id),x=(d.box[0]+d.box[2])/2/width,y=d.box[3]/height,dt=old?Math.max(.05,time-old.at):1;
   const vx=old ? .5*old.vx+.5*(x-old.x)/dt : 0,vy=old ? .5*old.vy+.5*(y-old.y)/dt : 0;
   const officialScore=old ? .65*old.officialScore+.35*d.evidence.official : d.evidence.official,playerScore=old ? .65*old.playerScore+.35*d.evidence.player : d.evidence.player;
   const t={id,x,y,vx,vy,age:old?old.age+1:1,confidence:d.confidence,officialScore,playerScore,box:[d.box[0]/width,d.box[1]/height,(d.box[2]-d.box[0])/width,(d.box[3]-d.box[1])/height],pixelBox:d.box,at:time};
   current.set(id,t);const {pixelBox,at,...publicTrack}=t;output.push(publicTrack);
  });
  for(const [id,t] of this.tracks)if(!current.has(id)&&time-t.at<1)current.set(id,t);
  this.tracks=current;return output;
 }
}
