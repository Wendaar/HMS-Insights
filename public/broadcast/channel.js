import {viewUrl} from './hms-source.js';
const valid=id=>typeof id==='string'&&/^[a-f0-9]{48}$/.test(id);
const storageKey='hms-obs-control-v1';
export function channelUrl(base,id){const url=new URL('index.html',base);url.search=new URLSearchParams({mode:'channel',channel:id});url.hash='';return url.href;}
export function createChannelControl({api,base,getState,onChange}){
  let binding=null,revision=0,visible=true,queued=null,sending=false,problem='',ready=false;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(valid(saved?.id)&&/^[a-f0-9]{64}$/.test(saved.key))binding=saved;}catch{}
  const imported=/^#control=([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(location.hash);
  if(imported){binding={id:imported[1],key:imported[2]};localStorage.setItem(storageKey,JSON.stringify(binding));const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);}
  const endpoint=()=>{const url=new URL(api,location.origin);url.search=new URLSearchParams(binding?{channel:binding.id}:{channels:'1'});return url.href;};
  async function request(method,body){
    const response=await fetch(endpoint(),{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:method==='GET'?{}:{'content-type':'application/json',...(binding?{authorization:'Bearer '+binding.key}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'OBS kanál nyní není dostupný. Zkuste to znovu.');return data;
  }
  const store=()=>localStorage.setItem(storageKey,JSON.stringify(binding));
  async function flush(){
    if(sending||!ready||!queued)return;sending=true;onChange();
    try{while(queued){const state=queued;queued=null;const row=await request('PATCH',{state,revision});revision=row.revision;if(!queued)visible=row.state.visible;problem='';}}
    catch(e){queued=null;problem=e.message;ready=false;}
    finally{sending=false;onChange();}
  }
  return {
    info:()=>({bound:!!binding,ready,visible,pending:sending,error:problem,url:binding?channelUrl(base,binding.id):''}),
    controlLink(){if(!binding)return '';const url=new URL(location.href);url.hash='control='+binding.id+'.'+binding.key;return url.href;},
    async init(){
      if(!binding)return;
      try{const row=await request('GET');revision=row.revision;visible=row.state.visible;ready=true;problem='';}
      catch(e){problem=e.message;ready=false;}onChange();
    },
    async create(){
      try{const row=await request('POST',{state:{...getState(),visible:true}});binding={id:row.id,key:row.controlKey};store();revision=row.revision;visible=true;ready=true;problem='';}
      catch(e){problem=e.message;}onChange();
    },
    publish(){if(binding&&ready){queued={...getState(),visible:queued?.visible??visible};flush();}},
    toggle(){if(binding&&ready){visible=!visible;queued={...getState(),visible};flush();}},
  };
}
export async function runChannelView({id,api,root,base}){
  document.body.className='render-mode channel-view';root.replaceChildren();
  let signature='',lastSuccess=0;
  async function poll(){
    try{
      if(!valid(id))throw new Error('Invalid channel');
      const url=new URL(api,location.origin);url.search=new URLSearchParams({channel:id});
      const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error('Channel unavailable');
      const row=await response.json(),s=row.state;
      if(row.id!==id||!s||typeof s.visible!=='boolean'||!['PHM','EUCHL'].includes(s.org))throw new Error('Invalid state');
      lastSuccess=Date.now();document.body.dataset.connection='ok';
      const next=JSON.stringify(s);
      if(next!==signature){
        signature=next;root.replaceChildren();
        if(s.visible){const frame=document.createElement('iframe');frame.title='HMS OBS';frame.src=viewUrl(base,{...s,source:'hms',mode:'overlay'});root.append(frame);}
      }
    }catch{
      document.body.dataset.connection='stale';
      if(!lastSuccess||Date.now()-lastSuccess>=10000){root.replaceChildren();signature='';}
    }finally{setTimeout(poll,2000);}
  }
  await poll();
}
