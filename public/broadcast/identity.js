// One page serves both the private controller and clean public OBS outputs.
export function broadcastIdentity(mode){
  const output=['overlay','channel','thumbnail'].includes(mode),kind=output?'public':'control';
  document.querySelectorAll('link[rel="icon"]').forEach(link=>link.remove());
  for(const [ext,type,sizes] of [['png','image/png','32x32'],['svg','image/svg+xml','any']]){
    const link=document.createElement('link');link.rel='icon';link.type=type;link.sizes=sizes;link.href=`/hms-favicon-${kind}-v2.${ext}`;document.head.append(link);
  }
  document.title=({'overlay':'OBS · Grafika','channel':'OBS · Výstup','thumbnail':'Broadcast · Miniatura'}[mode]??'Broadcast · Ovládání')+' | HMS';
}
