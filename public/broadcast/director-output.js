import {viewUrl} from './hms-source.js';
import {fitBroadcastCanvas} from './channel.js';
import {effectiveLayers,presentation} from './director-model.js';
import {safetyKey} from './director-channel.js';
// Reuse the existing overlay renderer in persistent, independently updated frames.
export function createDirectorFrames(root,{base=location.href}={}){
 const slots=new Map();
 function update(name,state,visible,library='',libraryRevision=0){
  let slot=slots.get(name);
  if(!visible){if(slot){slot.frame.remove();slot.fit();slots.delete(name);}return;}
  const scope=JSON.stringify([state.org,state.gameId,library]);
  const config={...presentation(state),org:state.org,gameId:state.gameId,lang:state.lang,libraryRevision};
  const signature=JSON.stringify(config);
  if(!slot||slot.scope!==scope){
   if(slot){slot.frame.remove();slot.fit();}
   const frame=document.createElement('iframe');frame.title=name==='main'?'MAIN GRAPHICS':'SPONSOR LAYER';frame.dataset.directorLayer=name;frame.style.border='0';
   frame.src=viewUrl(base,{...state,library,mode:'overlay',source:'hms'});const url=new URL(frame.src);url.searchParams.set('director','1');url.searchParams.set('layout','compact');frame.src=url.href;
   frame.style.zIndex=name==='main'?'2':'1';slot={frame,scope,signature,config,fit:fitBroadcastCanvas(frame)};slots.set(name,slot);root.append(frame);
   frame.addEventListener('load',()=>frame.contentWindow?.postMessage({type:'hms-director-render',...slot.config},location.origin));
  }else if(slot.signature!==signature){slot.signature=signature;slot.config=config;slot.frame.contentWindow?.postMessage({type:'hms-director-render',...config},location.origin);}
 }
 return {
  render(state,{library='',libraryRevision=0}={}){const visible=effectiveLayers(state);update('main',state,visible.main,library,libraryRevision);update('sponsors',{org:state.org,gameId:state.gameId,lang:state.lang,...state.sponsors},state.visible&&state.sponsors?.visible===true,library,libraryRevision);const sponsor=slots.get('sponsors');if(sponsor)sponsor.frame.style.visibility=visible.covered?'hidden':'visible';},
  clear(){for(const s of slots.values()){s.frame.remove();s.fit();}slots.clear();},
 };
}
export async function runDirectorOutput({id,api,root,base}){
 document.body.className='render-mode director-output';root.classList.add('director-compositor');root.replaceChildren();
 const frames=createDirectorFrames(root,{base});let timer,lastSuccess=0,lastRevision=0,blocked=false,blockedRevision=0,nonce=0;
 function safety(value){if(value?.blocked===true){blocked=true;blockedRevision=value.revision??Infinity;nonce++;frames.clear();}else if(value?.blocked===false&&value.revision>blockedRevision){blocked=false;nonce++;}}
 try{safety(JSON.parse(localStorage.getItem(safetyKey(id))));}catch{}
 let bus;try{bus=globalThis.BroadcastChannel?new BroadcastChannel(safetyKey(id)):null;}catch{}if(bus)bus.onmessage=e=>safety(e.data);
 addEventListener('storage',e=>{if(e.key===safetyKey(id))try{safety(JSON.parse(e.newValue));}catch{}});
 async function poll(){
  const epoch=nonce;
  try{
   const url=new URL(api,location.origin);url.search=new URLSearchParams({channel:id});
   const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(4000)});
   if(!response.ok)throw new Error('Channel unavailable');
   const row=await response.json();if(row.id!==id||row.state?.directorVersion!==2||row.revision<lastRevision)throw new Error('Invalid director state');
   lastSuccess=Date.now();lastRevision=row.revision;document.body.dataset.connection='ok';
   if(blocked&&row.revision>blockedRevision&&row.state.visible)blocked=false;
   if(epoch===nonce&&!blocked)frames.render(row.state,{library:id,libraryRevision:row.libraryRevision??0});
   else if(blocked)frames.clear();
   root.dataset.revision=String(lastRevision);
  }catch{document.body.dataset.connection='stale';if(!lastSuccess||Date.now()-lastSuccess>=10000)frames.clear();}
  finally{timer=setTimeout(poll,2000);}
 }
 addEventListener('pagehide',()=>{clearTimeout(timer);bus?.close();frames.clear();},{once:true});
 await poll();
}
