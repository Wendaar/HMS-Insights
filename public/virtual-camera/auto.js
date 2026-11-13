import {clamp,crop,aspect,OUTPUT_ASPECT} from './core.js';
import {settings} from './auto-settings.js';
export {settings,calibration} from './auto-settings.js';
// Coordinates refer to the complete source including any letterboxing. No puck claim.
export class AutoDirector {
 constructor(initial={}){this.reset(initial);}
 reset(initial={}){this.aspectRatio=aspect(initial);this.position=crop(initial);this.last=null;this.good=null;this.anchor=this.position.x;this.goalUntil=0;this.goalX=.5;this.candidate=null;this.candidateSince=0;}
 update(packet,now,options={}) {
  if(Number.isFinite(options.aspectRatio))this.aspectRatio=aspect(options);
  const baseWidth=Math.min(1,OUTPUT_ASPECT/this.aspectRatio);
  const cfg=settings(options),c=cfg.calibration,dt=this.last===null?.25:clamp(now-this.last,.001,.5);this.last=now;
  const tracks=(packet?.tracks??[]).filter(t=>[t.x,t.y,t.vx,t.vy,t.confidence].every(Number.isFinite)&&t.confidence>=.18&&t.age>=2&&t.x>=c.left&&t.x<=c.right&&t.y>=c.top&&t.y<=c.bottom&&!(t.y>=c.benchTop&&t.y<=c.benchBottom));
  let targetX=this.anchor,targetZoom=1,confidence=0,trackingState='SAFE_WIDE',reason='Bez spolehlivé detekce; široký záběr';
  if(tracks.length){
   const speed=t=>Math.hypot(t.vx,t.vy),moving=tracks.filter(t=>speed(t)>.018),active=moving.length?moving:tracks;
   // Local density plus motion, rather than total majority. An isolated moving lead can win.
   const scored=active.map(t=>({t,score:active.reduce((n,p)=>n+Math.exp(-(((p.x-t.x)/.14)**2))*(.2+Math.min(speed(p),.2)*4),0)}));
   scored.sort((a,b)=>b.score-a.score);const cluster=scored[0].t;
   const meanV=active.reduce((n,t)=>n+t.vx,0)/active.length,dir=Math.sign(meanV);
   const lead=active.filter(t=>t.age>=3&&Math.abs(t.vx)>.045&&Math.sign(t.vx)===dir&&dir*(t.x-cluster.x)>.13).sort((a,b)=>dir*(b.x-a.x))[0];
   let selected=lead??cluster;
   if(lead){
    if(this.candidate!==lead.id){this.candidate=lead.id;this.candidateSince=now;}
    if(now-this.candidateSince<.4)selected=cluster;
   }else this.candidate=null;
   const group=active.filter(t=>Math.abs(t.x-selected.x)<.18);
   const weights=group.map(t=>.25+Math.min(speed(t),.15)*3);
   const center=group.reduce((sum,t,i)=>sum+t.x*weights[i],0)/weights.reduce((a,b)=>a+b,0);
   targetX=clamp(center+selected.vx*(.25+.4*cfg.sensitivity),c.left,c.right);
   confidence=clamp(group.reduce((n,t)=>n+t.confidence,0)/group.length*.65+Math.min(group.length,4)*.07,0,1);
   trackingState=selected===lead?'BREAKAWAY_CANDIDATE':Math.abs(meanV)>.035?'TRANSITION':'PLAY_AREA';
   reason=selected===lead?'Pravděpodobný aktivní únik':trackingState==='TRANSITION'?'Pohyb hry a krátká predikce':'Aktivní oblast hráčů';
   if(!moving.length){confidence*=.65;reason='Malý pohyb; konzervativní přehled';trackingState='STOPPAGE_CANDIDATE';}
   const spread=Math.max(...group.map(t=>t.x))-Math.min(...group.map(t=>t.x));
   targetZoom=Math.max(1,Math.min(cfg.preferredZoom,baseWidth/Math.max(baseWidth*.45,spread+baseWidth*.32)));
   if(trackingState==='TRANSITION'||selected===lead)targetZoom=Math.max(1,targetZoom-.25);
   if(confidence>=.34){this.good=now;this.anchor=targetX;
    if(moving.length&&Math.min(Math.abs(targetX-c.left),Math.abs(targetX-c.right))<.16){this.goalUntil=now+1.5;this.goalX=targetX;}
   }
  }
  if(confidence<.34){const age=this.good===null?Infinity:now-this.good;targetX=age<2?this.anchor:c.center;targetZoom=age<1?this.position.zoom:1;trackingState=age<2?'HOLD':'SAFE_WIDE';reason=age<2?'Nízká jistota; držím poslední oblast':'Nejistota nebo výpadek; bezpečný široký záběr';}
  else if(now<this.goalUntil&&Math.abs(targetX-this.goalX)>.18){targetX=this.goalX;targetZoom=Math.min(targetZoom,1.6);trackingState='GOAL_HOLD';reason='Krátké podržení prostoru u branky';}
  // Dead band and bounded speed also apply to recovery. Y stays fixed.
  const maxSpeed=.08+cfg.sensitivity*.16,delta=targetX-this.position.x;
  const x=this.position.x+(Math.abs(delta)<.012?0:clamp(delta*(1-Math.exp(-dt/ .7)),-maxSpeed*dt,maxSpeed*dt));
  // Widening near an edge must not force crop() to snap the center inward.
  const safeZoom=baseWidth/2/Math.min(.5,Math.min(this.position.x,1-this.position.x)+maxSpeed*dt);
  const zoom=Math.max(safeZoom,this.position.zoom+clamp(targetZoom-this.position.zoom,-.5*dt,.25*dt));
  this.position=crop({x,y:this.position.y,zoom,aspectRatio:this.aspectRatio});
  return {...this.position,targetX,targetZoom,confidence,trackingState,reason,tracks};
 }
}
