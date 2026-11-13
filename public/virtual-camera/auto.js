import {clamp,crop,aspect,OUTPUT_ASPECT} from './core.js';
import {settings} from './auto-settings.js';
export {settings,calibration} from './auto-settings.js';
const speed=t=>Math.hypot(t.vx,t.vy);
const official=t=>clamp(Number(t.officialScore)||0,0,1);
const player=t=>clamp(Number(t.playerScore)||0,0,1);
// Coordinates refer to the complete source. Role and event labels are estimates.
export class AutoDirector {
 constructor(initial={}){this.reset(initial);}
 reset(initial={}){
  this.aspectRatio=aspect(initial);this.position=crop(initial);this.last=null;this.good=null;
  this.anchor=this.position.x;this.goalUntil=0;this.goalX=.5;this.candidate=null;this.lead=null;
  this.history=new Map();this.packetTime=null;
 }
 update(packet,now,options={}) {
  if(Number.isFinite(options.aspectRatio))this.aspectRatio=aspect(options);
  const baseWidth=Math.min(1,OUTPUT_ASPECT/this.aspectRatio),cfg=settings(options),c=cfg.calibration;
  const referee=t=>cfg.filterOfficials?official(t):0,weight=t=>(.55+.45*player(t))*(1-.9*referee(t));
  const dt=this.last===null?.25:clamp(now-this.last,.001,.5);this.last=now;
  const valid=t=>[t.x,t.y,t.vx,t.vy,t.confidence].every(Number.isFinite)&&t.confidence>=.18&&t.age>=2&&t.x>=c.left&&t.x<=c.right&&t.y>=c.top&&t.y<=c.bottom&&!(t.y>=c.benchTop&&t.y<=c.benchBottom);
  // Motion blobs must never become independent players or confirm an event.
  const all=(packet?.tracks??[]).filter(t=>valid(t)&&t.source!=='colour_motion');
  const motionHints=(packet?.tracks??[]).filter(t=>valid(t)&&t.source==='colour_motion'&&t.age>=4&&speed(t)>.045);
  const ignoredOfficials=all.filter(t=>t.age>=3&&referee(t)>=.55&&player(t)<.35);
  const tracks=all.filter(t=>!ignoredOfficials.includes(t));
  const stamp=packet?.time??now,fresh=!!packet&&stamp!==this.packetTime;
  if(fresh){
   this.packetTime=stamp;
   for(const t of tracks){const old=this.history.get(t.id),points=old&&now-old.seen<1?old.points.filter(p=>now-p.time<1.2):[];points.push({x:t.x,time:now});this.history.set(t.id,{points,seen:now});}
   for(const [id,h] of this.history)if(now-h.seen>1.2)this.history.delete(id);
  }
  let targetX=this.anchor,targetZoom=1,confidence=0,trackingState='SAFE_WIDE',reason='Bez spolehlivého hráče; široký záběr',focusId=null,breakawayId=null,leadHintX=null;
  if(tracks.length){
   const moving=tracks.filter(t=>speed(t)>.018);
   const activity=t=>moving.length&&speed(t)<.015?.5:1;
   const scored=tracks.map(t=>({t,score:weight(t)*tracks.reduce((n,p)=>n+Math.exp(-(((p.x-t.x)/.13)**2))*weight(p)*activity(p)*(.25+Math.min(speed(p),.15)*4),0)}));
   scored.sort((a,b)=>b.score-a.score);const cluster=scored[0].t;
   // Test both directions: a counterattacker can oppose the majority flow.
   const candidates=tracks.flatMap(t=>{
    const dir=Math.sign(t.vx),h=this.history.get(t.id),first=h?.points[0];
    if(t.age<3||Math.abs(t.vx)<.035||Math.abs(t.vx)>.35||!first||h.points.length<2||dir*(t.x-first.x)<.012||referee(t)>.3)return [];
    const behind=tracks.filter(p=>p.id!==t.id&&dir*(t.x-p.x)>.10);
    // Sparse detections: a clearly coloured fast skater may have only one visible trailer.
    if(behind.length<2&&!(behind.length===1&&player(t)>.55&&Math.abs(t.vx)>.055))return [];
    const separation=behind.reduce((n,p)=>n+dir*(t.x-p.x),0)/behind.length;
    return [{t,score:separation+.8*Math.abs(t.vx)+.15*player(t)}];
   }).sort((a,b)=>b.score-a.score);
   const proposed=candidates[0]?.t;
   if(fresh){
    if(proposed){
     const old=this.candidate,same=old&&(old.id===proposed.id||(player(proposed)>.45&&Math.sign(proposed.vx)===Math.sign(old.vx)&&Math.abs(proposed.x-(old.x+old.vx*(now-old.at)))<.07));
     this.candidate={id:proposed.id,x:proposed.x,vx:proposed.vx,at:now,since:same?old.since:now,count:same?old.count+1:1};
     if(this.candidate.count>=2&&now-this.candidate.since>=.22)this.lead={...proposed,at:now};
    }else this.candidate=null;
    if(this.lead){const seen=tracks.find(t=>t.id===this.lead.id);if(seen&&Math.sign(seen.vx)===Math.sign(this.lead.vx)&&Math.abs(seen.vx)>.02&&referee(seen)<.3)this.lead={...seen,at:now};}
   }
   const locked=this.lead&&now-this.lead.at<.7?this.lead:null;
   const selected=locked?{...locked,x:clamp(locked.x+locked.vx*Math.min(.5,now-locked.at),c.left,c.right)}:cluster;
   const group=locked?[selected]:tracks.filter(t=>Math.abs(t.x-selected.x)<.18);
   const weights=group.map(t=>weight(t)*(.25+Math.min(speed(t),.15)*3));
   const center=group.reduce((sum,t,i)=>sum+t.x*weights[i],0)/weights.reduce((a,b)=>a+b,0);
   targetX=clamp(center+selected.vx*(locked?.65:.25+.4*cfg.sensitivity),c.left,c.right);focusId=selected.id;
   if(locked){
    const direction=Math.sign(selected.vx),ahead=motionHints.filter(t=>Math.sign(t.vx)===direction&&direction*(t.x-center)>0&&direction*(t.x-center)<.18&&Math.abs(t.y-selected.y)<.12);
    if(ahead.length){leadHintX=direction>0?Math.max(...ahead.map(t=>t.x)):Math.min(...ahead.map(t=>t.x));targetX=clamp(targetX+direction*clamp(direction*(leadHintX-targetX),0,.08),c.left,c.right);}
   }
   const roleTrust=group.reduce((n,t)=>n+weight(t),0)/group.length;
   confidence=clamp((group.reduce((n,t)=>n+t.confidence,0)/group.length*.65+Math.min(group.length,4)*.07)*(.65+.35*roleTrust),0,1);
   const flow=moving.reduce((n,t)=>n+t.vx,0)/Math.max(1,moving.length);
   trackingState=locked?(now-locked.at>.3?'BREAKAWAY_HOLD':'BREAKAWAY_CANDIDATE'):Math.abs(flow)>.035?'TRANSITION':'PLAY_AREA';
   reason=locked?'Rychlý hráč před částí skupiny; předstihový koridor':trackingState==='TRANSITION'?'Přesun aktivních hráčů':'Aktivní oblast; pravděpodobní rozhodčí mají nižší váhu';
   if(locked){breakawayId=selected.id;confidence=Math.max(.38,confidence);}
   else if(!moving.length){confidence*=.65;reason='Malý pohyb; konzervativní přehled';trackingState='STOPPAGE_CANDIDATE';}
   const spread=Math.max(...group.map(t=>t.x))-Math.min(...group.map(t=>t.x));
   targetZoom=Math.max(1,Math.min(cfg.preferredZoom,baseWidth/Math.max(baseWidth*.45,spread+baseWidth*.32)));
   if(locked)targetZoom=Math.min(targetZoom,1.35);
   else if(trackingState==='TRANSITION')targetZoom=Math.max(1,targetZoom-.25);
   if(locked||moving.filter(t=>Math.abs(t.vx)>.035).length>=2&&Math.abs(targetX-this.goalX)>.16)this.goalUntil=0;
   if(confidence>=.34){this.good=now;this.anchor=targetX;
    if(!locked&&moving.length&&Math.min(Math.abs(targetX-c.left),Math.abs(targetX-c.right))<.16){this.goalUntil=now+.8;this.goalX=targetX;}
   }
  }
  if(confidence<.34){const age=this.good===null?Infinity:now-this.good;targetX=age<2?this.anchor:c.center;targetZoom=age<1?this.position.zoom:1;trackingState=age<2?'HOLD':'SAFE_WIDE';reason=ignoredOfficials.length&&!tracks.length?'Pouze pravděpodobní rozhodčí; bezpečný přehled':age<2?'Nízká jistota; držím poslední oblast':'Nejistota nebo výpadek; bezpečný široký záběr';focusId=null;}
  else if(now<this.goalUntil&&Math.abs(targetX-this.goalX)>.18){targetX=this.goalX;targetZoom=Math.min(targetZoom,1.6);trackingState='GOAL_HOLD';reason='Krátké podržení prostoru u branky';}
  const chasing=trackingState.startsWith('BREAKAWAY'),maxSpeed=(.08+cfg.sensitivity*.16)*(chasing?1.65:1),delta=targetX-this.position.x;
  const x=this.position.x+(Math.abs(delta)<.012?0:clamp(delta*(1-Math.exp(-dt/(chasing?.4:.7))),-maxSpeed*dt,maxSpeed*dt));
  const safeZoom=baseWidth/2/Math.min(.5,Math.min(this.position.x,1-this.position.x)+maxSpeed*dt);
  const zoom=Math.max(safeZoom,this.position.zoom+clamp(targetZoom-this.position.zoom,-.5*dt,.25*dt));
  this.position=crop({x,y:this.position.y,zoom,aspectRatio:this.aspectRatio});
  return {...this.position,targetX,targetZoom,confidence,trackingState,reason,tracks,ignoredOfficials,focusId,breakawayId,leadHintX};
 }
}
