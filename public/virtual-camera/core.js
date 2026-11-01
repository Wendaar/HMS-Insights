export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function crop(s){const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;const z=clamp(num(s.zoom,1),1,4),h=0.5/z;return {zoom:z,x:clamp(num(s.x,.5),h,1-h),y:clamp(num(s.y,.5),h,1-h)};}
export function sourceURL(value,{audio=false}={}){
 const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='vdo.ninja'||u.username||u.password||!u.searchParams.get('view')||u.searchParams.has('push')||u.searchParams.has('scene')||u.searchParams.has('director'))throw Error('Vložte HTTPS odkaz vdo.ninja s ?view=ID pro jedinou kameru.');
 const view=u.searchParams.get('view');if(/[,*]/.test(view))throw Error('V1 podporuje jeden zdroj.');
 const safe=new URL('https://vdo.ninja/');for(const k of ['view','password','room','salt','codec','bitrate','quality'])if(u.searchParams.has(k))safe.searchParams.set(k,u.searchParams.get(k));
 for(const k of ['cleanoutput','autostart'])safe.searchParams.set(k,'');if(!audio)safe.searchParams.set('noaudio','');return safe.href;
}
export function cameraKeyPatch(state,key,shift=false){
 const step=(shift?.003:.02)/state.zoom;
 return {arrowleft:{x:state.x-step},arrowright:{x:state.x+step},arrowup:{y:state.y-step},arrowdown:{y:state.y+step},w:{zoom:state.zoom+.1},s:{zoom:state.zoom-.1},'+':{zoom:state.zoom+.1},'=':{zoom:state.zoom+.1},'-':{zoom:state.zoom-.1},r:{x:.5,y:.5,zoom:1}}[key.toLowerCase()];
}
export function normalize(s){if(typeof s!=='object'||!s)throw Error('Neplatná konfigurace');return {...crop(s),source:s.source?sourceURL(s.source):'',smooth:s.smooth===true,venue:String(s.venue||'').slice(0,80)};}
