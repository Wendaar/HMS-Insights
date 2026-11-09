// A single non-overlapping timer. Consumers decide whether their Today view is visible.
export function createTodayPoller({isActive,refresh,onError=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,interval=30000}){
  let timer=null,running=false,enabled=false,controller=null,failures=0;
  const cancelTimer=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  function pause(){enabled=false;cancelTimer();controller?.abort();}
  function schedule(delay){cancelTimer();timer=setTimer(tick,delay);}
  async function tick(){
    timer=null;
    if(!enabled||!isActive())return;
    running=true;controller=new AbortController();let delay=interval;
    try{await refresh(controller.signal);failures=0;}
    catch(error){
      if(error.name!=='AbortError'){
        failures++;delay=Math.min(300000,Math.max(interval*2**Math.min(failures,4),(Number(error.retryAfter)||0)*1000));
        onError(error);
      }
    }finally{running=false;controller=null;if(enabled&&isActive())schedule(delay);}
  }
  function sync({immediate=false}={}){
    if(!isActive()){pause();return;}
    enabled=true;
    if(!running&&timer===null)schedule(immediate?0:interval);
  }
  return {sync,pause};
}

// Refresh all previously displayed pages, retaining scope and never sending an HMS token.
export async function readTodayPages(params,loadedCount,{fetchImpl=fetch,signal}={}){
  const items=[],seen=new Set();let offset=0,latest;
  do{
    const query=new URLSearchParams(params);query.set('view','games');query.set('filter','Today');query.delete('windowPage');query.set('offset',String(offset));
    const response=await fetchImpl('/api/game-summary?'+query,{headers:{accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),cache:'no-store'});
    if(!response.ok)throw Object.assign(new Error('Live scores unavailable'),{status:response.status,retryAfter:response.headers.get('retry-after')});
    const data=await response.json();
    if(data.seasonId!==params.get('seasonId')?.toLowerCase()||data.filter!=='Today'||!Array.isArray(data.items)||data.hasMore&&!data.items.length||data.offset!==offset||!Number.isInteger(data.limit)||data.limit<1)throw Error('Wrong live page');
    for(const item of data.items)if(!seen.has(item.id)){seen.add(item.id);items.push(item);}
    latest=data;offset+=data.limit;
  }while(latest.hasMore&&offset<Math.max(20,loadedCount));
  return {...latest,items,nextOffset:offset};
}
