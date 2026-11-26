import {channelUrl} from './channel.js';
import {mixerFromState,sameGame} from './director-model.js';
const valid=id=>/^[a-f0-9]{48}$/.test(id??'');
export const safetyKey=id=>'hms-broadcast-v2-safety:'+id;
export function signalSafety(id,value){
 try{localStorage.setItem(safetyKey(id),JSON.stringify(value));}catch{}
 try{const bus=new BroadcastChannel(safetyKey(id));bus.postMessage(value);bus.close();}catch{}
}
export function createDirectorChannel({api='/api/broadcast',base=location.href,onChange=()=>{},getDraft}){
 let binding=null,row=null,error='',pending=0,generation=0,stopped=false,timer,sandbox=true,hidePending=false;
 const storage='hms-obs-director-v2';
 try{const saved=JSON.parse(localStorage.getItem(storage));if(valid(saved?.id)&&/^[a-f0-9]{64}$/.test(saved.key))binding=saved;}catch{}
 const imported=/^#director=([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(location.hash);
 if(imported){binding={id:imported[1],key:imported[2]};localStorage.setItem(storage,JSON.stringify(binding));history.replaceState(null,'',location.pathname+location.search);}
 const notify=()=>onChange();
 async function request(method,body,library=false){
  const url=new URL(api,location.origin);url.search=new URLSearchParams(binding?{channel:binding.id,...(library?{library:'1'}:{})}:{channels:'1'});
  const response=await fetch(url,{method,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(8000),headers:{...(method!=='GET'?{'content-type':'application/json',...(binding?{authorization:'Bearer '+binding.key}:{})}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'OBS connection failed');return data;
 }
 function accept(next){if(!row||next.revision>=row.revision){row=next;sandbox=next.sandbox===true;}error='';}
 async function refresh(){if(!binding||pending)return;try{accept(await request('GET'));}catch(e){error=e.message;}notify();}
 async function publish(build){
  if(!row||pending||hidePending)return;
  const epoch=generation;pending++;notify();
  try{
   const state=build(mixerFromState(row.state));
   const next=await request('PATCH',{state,revision:row.revision});
   if(epoch!==generation)return;
   accept(next);signalSafety(binding.id,{blocked:false,revision:row.revision});
  }catch(e){if(epoch===generation)error=e.message;}finally{pending--;notify();}
 }
 const control={
  info:()=>({id:binding?.id,bound:!!binding,ready:!!row,error,pending:pending>0,hidePending,state:row?.state,revision:row?.revision,sandbox,url:binding?channelUrl(base,binding.id,{sandbox}):''}),
  library:()=>request('GET',null,true),saveLibrary:(items,revision)=>request('PATCH',{items,revision},true),
  controlLink(){const url=new URL(base);url.hash='director='+binding.id+'.'+binding.key;return url.href;},
  async create(){if(binding||pending)return;pending++;notify();try{const draft=getDraft(),state=mixerFromState({...draft,visible:false});state.mainVisible=false;const next=await request('POST',{state});binding={id:next.id,key:next.controlKey};localStorage.setItem(storage,JSON.stringify(binding));accept(next);}catch(e){error=e.message;}finally{pending--;notify();}},
  async init(){await refresh();if(!stopped)timer=setTimeout(tick,2000);},
  refresh,
  showMain:()=>publish(current=>{const draft=getDraft();return {...current,...draft,directorVersion:2,visible:true,mainVisible:true,sponsors:sameGame(current,draft)?current.sponsors:{...current.sponsors,visible:false}};}),
  hideMain:()=>publish(current=>({...current,mainVisible:false})),
  showSponsors:sponsors=>publish(current=>{const draft=getDraft();return {...current,...(!sameGame(current,draft)?{...draft,mainVisible:false}:{}),visible:true,sponsors:{...sponsors,layer:'sponsors',corner:'bottom-right',visible:true}};}),
  hideSponsors:()=>publish(current=>({...current,sponsors:{...current.sponsors,visible:false}})),
  async hideAll(){
   if(!binding)return;
   generation++;hidePending=true;signalSafety(binding.id,{blocked:true});notify();
   // Authenticated atomic hide bypasses HMS reads and optimistic-revision conflicts.
   try{const next=await request('PATCH',{action:'hide-all'});accept(next);hidePending=false;signalSafety(binding.id,{blocked:true,revision:next.revision});}
   catch(e){error=e.message;}notify();
  },
  stop(){stopped=true;clearTimeout(timer);},
 };
 async function tick(){if(stopped)return;if(hidePending)await control.hideAll();else await refresh();if(!stopped)timer=setTimeout(tick,2000);}
 return control;
}
