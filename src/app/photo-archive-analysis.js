import {randomUUID} from 'node:crypto';
import {analyzePhoto} from '../../photo-archive/vision.mjs';
import {pilotObservations} from '../../photo-archive/pilot-observations.mjs';
import {ANALYSIS_VERSION} from '../../photo-archive/jersey-context.mjs';

export function analysisStats(state){
  const photos=state?.photos || [],analyses=state?.analyses || {};
  return {total:photos.length,complete:photos.filter(p=>analyses[p.id]?.status==='complete' || !analyses[p.id] && pilotObservations[p.id]).length,
    outdated:photos.filter(p=>analyses[p.id]?.status==='complete' && analyses[p.id].analysisVersion!==ANALYSIS_VERSION || !analyses[p.id] && pilotObservations[p.id]).length,
    failed:photos.filter(p=>analyses[p.id]?.status==='failed').length,processing:photos.filter(p=>analyses[p.id]?.status==='processing').length,
    remaining:photos.filter(p=>(!analyses[p.id] && !pilotObservations[p.id] || analyses[p.id]?.status==='queued') && p.previewUrl).length};
}
export function createArchiveAnalysis({env,store,context,view,requireStorage,fail,now,fetchImpl,analyzer=analyzePhoto}){
  const key=id=>id.toLowerCase();
  const config=()=>{
    requireStorage();
    if(!env.OPENAI_API_KEY?.trim())fail(503,'OpenAI API klíč není v tomto Preview dostupný.');
    if(env.PHOTO_VISION_MODEL!=='gpt-6-luna')fail(503,'Pro pilotní AI kontrolu nastavte PHOTO_VISION_MODEL=gpt-6-luna.');
  };
  async function load(org,body){
    const item=await context(org,body?.gameId),row=await store.get(org,key(item.gameId));
    if(!row?.draft)fail(409,'Nejdříve načtěte album.');
    if(body.revision!==row.revision)fail(409,'Album se mezitím změnilo. Obnovte data a pokračujte.');
    return {item,row,state:row.draft};
  }
  async function save(org,item,row,state){
    const saved=await store.save(org,key(item.gameId),state,row.revision,null);
    if(!saved)fail(409,'Album změnil jiný uživatel. Obnovte data a pokračujte.');
    return view(saved,item);
  }
  return {
    async startAnalysis(org,body){
      config();const {item,row,state}=await load(org,body);
      const limit=body.limit ?? 250;
      if(!Number.isInteger(limit) || limit<1 || limit>250 || body.retryFailed!==undefined && typeof body.retryFailed!=='boolean')fail(400,'Vyberte nejvýše 250 fotografií.');
      if(body.upgradeOld!==undefined && typeof body.upgradeOld!=='boolean')fail(400,'Neplatná volba aktualizace AI.');
      if(body.photoId!==undefined && !state.photos.some(p=>p.id===body.photoId))fail(400,'Fotografie nepatří do alba.');
      const analyses={...state.analyses};
      for(const [id,a] of Object.entries(analyses))if(a.status==='processing'){
        if(Date.parse(now())-Date.parse(a.startedAt)<120000)fail(409,'Jedna fotografie se právě zpracovává. Vyčkejte a obnovte stav.');
        analyses[id]={...a,status:'failed',error:'interrupted',finishedAt:now()};
      }
      const targets=state.photos.filter(p=>(!body.photoId || p.id===body.photoId) && p.previewUrl && (!analyses[p.id] && !pilotObservations[p.id] || analyses[p.id]?.status==='queued' || body.retryFailed===true && analyses[p.id]?.status==='failed' || body.upgradeOld===true && (analyses[p.id]?.status==='complete' && analyses[p.id].analysisVersion!==ANALYSIS_VERSION || !analyses[p.id] && pilotObservations[p.id]))).slice(0,limit).map(p=>p.id);
      for(const id of targets)if(analyses[id]?.status==='failed' || analyses[id]?.status==='complete')analyses[id]={...analyses[id],status:'queued',previousError:analyses[id].error};
      const analysisJob={id:randomUUID(),status:targets.length?'running':'completed',targets,startedAt:now(),finishedAt:targets.length?null:now(),model:env.PHOTO_VISION_MODEL};
      return save(org,item,row,{...state,analyses,analysisJob});
    },
    async nextAnalysis(org,body){
      config();const {item,row,state}=await load(org,body),job=state.analysisJob;
      if(!job || job.id!==body.jobId)fail(409,'Tato AI kontrola už není aktuální. Obnovte data.');
      if(job.status!=='running')return view(row,item);
      if(job.targets.some(id=>state.analyses?.[id]?.status==='processing'))fail(409,'Fotografie se již zpracovává. Obnovte stav.');
      const photo=state.photos.find(p=>job.targets.includes(p.id) && !['complete','failed'].includes(state.analyses?.[p.id]?.status));
      if(!photo)return save(org,item,row,{...state,analysisJob:{...job,status:'completed',finishedAt:now()}});
      const claim=randomUUID(),startedAt=now();
      const previous=state.analyses?.[photo.id];
      const reserved=await store.save(org,key(item.gameId),{...state,analyses:{...state.analyses,[photo.id]:{...previous,status:'processing',claim,startedAt,model:env.PHOTO_VISION_MODEL}}},row.revision,null);
      if(!reserved)fail(409,'Fotografii současně převzal jiný požadavek. Obnovte data.');
      let result;
      try{
        const output=await analyzer(photo.previewUrl,{env,fetchImpl,timeoutMs:35000,teams:state.teams});
        result={status:'complete',analysisVersion:ANALYSIS_VERSION,model:output.model,observations:output.observations,usage:output.usage,startedAt,finishedAt:now()};
      }catch(error){
        // Never return provider text, keys or image URLs. Failed/uncertain calls need explicit retry.
        const message=String(error.message || '');
        const category=/credit_balance_exhausted|insufficient_quota|quota_or_billing/.test(message)?'quota':/HTTP 401|HTTP 403/.test(message)?'credentials':/HTTP 429/.test(message)?'rate_limit':/timeout|abort/i.test(message)?'timeout':'analysis_failed';
        result={status:'failed',error:category,observations:previous?.observations,analysisVersion:previous?.analysisVersion,model:env.PHOTO_VISION_MODEL,startedAt,finishedAt:now()};
      }
      // Merge against the latest revision so reviews saved during the model call survive.
      for(let attempt=0;attempt<6;attempt++){
        const latest=await store.get(org,key(item.gameId)),draft=latest?.draft;
        if(draft?.analyses?.[photo.id]?.claim!==claim)fail(409,'Výsledek nelze bezpečně připojit. Obnovte data.');
        const analyses={...draft.analyses,[photo.id]:result},active=draft.analysisJob;
        const done=active?.targets.every(id=>['complete','failed'].includes(analyses[id]?.status));
        const analysisJob=active?.id===job.id?{...active,status:result.status==='failed'?'failed':done?'completed':active.status,
          ...(result.status==='failed' || done?{finishedAt:now()}:{}),lastError:result.error || null}:active;
        const saved=await store.save(org,key(item.gameId),{...draft,analyses,analysisJob},latest.revision,null);
        if(saved)return view(saved,item);
      }
      fail(409,'Výsledek nebylo možné uložit kvůli souběžným změnám. Obnovte data; analýzu automaticky neopakujeme.');
    }
  };
}
