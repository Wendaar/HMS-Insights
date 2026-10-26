import {viewUrl} from './hms-source.js';
import {publicOutputUrl} from '../public-output.js';
const valid=id=>typeof id==='string'&&/^[a-f0-9]{48}$/.test(id);
const storageKey='hms-obs-control-v1';
// Keep layout at the OBS design resolution; fit the whole frame, never crop it.
export function fitBroadcastCanvas(element){
  const resize=()=>{
    const scale=Math.min(innerWidth/1920,innerHeight/1080);
    Object.assign(element.style,{position:'fixed',width:'1920px',height:'1080px',
      left:`${(innerWidth-1920*scale)/2}px`,top:`${(innerHeight-1080*scale)/2}px`,
      transform:`scale(${scale})`,transformOrigin:'top left'});
  };
  resize();addEventListener('resize',resize);
  return ()=>removeEventListener('resize',resize);
}
export function channelUrl(base,id,{sandbox=false}={}){const url=new URL('/broadcast/index.html',base);url.search=new URLSearchParams({mode:'channel',channel:id});url.hash='';return sandbox?url.href:publicOutputUrl(url.href);}
export function createChannelControl({api,base,getState,onChange}){
  let binding=null,revision=0,visible=true,queued=null,sending=false,problem='',ready=false,lastState=null,sandbox=false;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(valid(saved?.id)&&/^[a-f0-9]{64}$/.test(saved.key))binding=saved;}catch{}
  const imported=/^#control=([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(location.hash);
  if(imported){binding={id:imported[1],key:imported[2]};localStorage.setItem(storageKey,JSON.stringify(binding));const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);}
  const endpoint=library=>{const url=new URL(api,location.origin);url.search=new URLSearchParams(binding?{channel:binding.id,...(library?{library:'1'}:{})}:{channels:'1'});return url.href;};
  async function request(method,body,library=false){
    const response=await fetch(endpoint(library),{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:method==='GET'?{}:{'content-type':'application/json',...(binding?{authorization:'Bearer '+binding.key}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'OBS kanál nyní není dostupný. Zkuste to znovu.');return data;
  }
  const store=()=>localStorage.setItem(storageKey,JSON.stringify(binding));
  async function flush(){
    if(sending||!ready||!queued)return;sending=true;onChange();
    try{while(queued){const state=queued;queued=null;const row=await request('PATCH',{state,revision});revision=row.revision;lastState=row.state;if(!queued)visible=row.state.visible;problem='';}}
    catch(e){queued=null;problem=e.message;ready=false;}
    finally{sending=false;onChange();}
  }
  return {
    info:()=>({id:binding?.id??'',bound:!!binding,ready,visible,pending:sending,error:problem,url:binding?channelUrl(base,binding.id,{sandbox}):''}),
    library:()=>request('GET',null,true),
    saveLibrary:(items,revision)=>request('PATCH',{items,revision},true),
    controlLink(){if(!binding)return '';const url=new URL(location.href);url.hash='control='+binding.id+'.'+binding.key;return url.href;},
    async init(){
      if(!binding)return;
      try{const row=await request('GET');sandbox=row.sandbox===true;revision=row.revision;lastState=row.state;visible=row.state.visible;ready=true;problem='';}
      catch(e){problem=e.message;ready=false;}onChange();
    },
    async create(){
      try{const row=await request('POST',{state:{...getState(),visible:true}});sandbox=row.sandbox===true;binding={id:row.id,key:row.controlKey};store();revision=row.revision;lastState=row.state;visible=true;ready=true;problem='';}
      catch(e){problem=e.message;}onChange();
    },
    publish(){if(binding&&ready){queued={...getState(),visible:queued?.visible??visible};flush();}},
    toggle(){if(binding&&ready&&lastState){visible=!visible;queued={...(queued??lastState),visible};flush();}},
  };
}
export async function runChannelView({id,api,root,base}){
  document.body.className='render-mode channel-view';root.replaceChildren();
  let signature='',lastSuccess=0;
  let stopFitting;
  async function poll(){
    try{
      if(!valid(id))throw new Error('Invalid channel');
      const url=new URL(api,location.origin);url.search=new URLSearchParams({channel:id});
      const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error('Channel unavailable');
      const row=await response.json(),s=row.state;
      if(row.id!==id||!s||typeof s.visible!=='boolean'||!['PHM','EUCHL'].includes(s.org))throw new Error('Invalid state');
      lastSuccess=Date.now();document.body.dataset.connection='ok';
      const next=JSON.stringify([s,row.libraryRevision??0]);
      if(next!==signature){
        signature=next;stopFitting?.();stopFitting=null;root.replaceChildren();
        if(s.visible){const frame=document.createElement('iframe');frame.title='HMS OBS';frame.src=viewUrl(base,{...s,library:id,source:'hms',mode:'overlay'});stopFitting=fitBroadcastCanvas(frame);root.append(frame);}
      }
    }catch{
      document.body.dataset.connection='stale';
      if(!lastSuccess||Date.now()-lastSuccess>=10000){stopFitting?.();stopFitting=null;root.replaceChildren();signature='';}
    }finally{setTimeout(poll,2000);}
  }
  await poll();
}
