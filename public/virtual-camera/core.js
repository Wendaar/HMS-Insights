import {settings} from './auto-settings.js';
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const OUTPUT_WIDTH=1920,OUTPUT_HEIGHT=1080,OUTPUT_ASPECT=OUTPUT_WIDTH/OUTPUT_HEIGHT;
export const aspect=s=>Number.isFinite(Number(s.aspectRatio))&&Number(s.aspectRatio)>=.25&&Number(s.aspectRatio)<=8?Number(s.aspectRatio):OUTPUT_ASPECT;
export function cropSize(s){const r=aspect(s),z=clamp(Number(s.zoom)||1,1,4);return {width:Math.min(1,OUTPUT_ASPECT/r)/z,height:Math.min(1,r/OUTPUT_ASPECT)/z};}
export function crop(s){const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;const z=clamp(num(s.zoom,1),1,4),{width,height}=cropSize({...s,zoom:z});return {zoom:z,x:clamp(num(s.x,.5),width/2,1-width/2),y:clamp(num(s.y,.5),height/2,1-height/2)};}
// Read only inbound numeric video metadata; never forward raw stats/stream IDs to diagnostics.
export function videoStats(stats){
 const visit=(v,depth=0)=>{if(!v||typeof v!=='object'||depth>4)return null;
  const match=/^(\d+)\s*[x×]\s*(\d+)/.exec(v.Resolution||v.resolution||'');
  const width=Number(v._frameWidth||v.frameWidth||match?.[1]),height=Number(v._frameHeight||v.frameHeight||match?.[2]);
  if(width>0&&height>0&&width<=32768&&height<=32768&&width/height>=.25&&width/height<=8)return {width,height,frames:Number(v._decodeFrames??v._framesDecoded??v.framesDecoded),stamp:Number(v._last_time??v._timestamp??v.timestamp)};
  for(const child of Object.values(v)){const found=visit(child,depth+1);if(found)return found;}return null;};
 return visit(stats?.inbound);
}
export function sourceURL(value,{audio=false}={}){
 const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='vdo.ninja'||u.username||u.password||!u.searchParams.get('view')||u.searchParams.has('push')||u.searchParams.has('scene')||u.searchParams.has('director'))throw Error('Vložte HTTPS odkaz vdo.ninja s ?view=ID pro jedinou kameru.');
 const view=u.searchParams.get('view');if(/[,*]/.test(view))throw Error('V1 podporuje jeden zdroj.');
 const safe=new URL('https://vdo.ninja/');for(const k of ['view','password','room','salt','codec','bitrate','videobitrate','vb','audiobitrate','ab','quality'])if(u.searchParams.has(k))safe.searchParams.set(k,u.searchParams.get(k));
 for(const k of ['cleanoutput','autostart'])safe.searchParams.set(k,'');safe.searchParams.set('scale','100');if(!audio)safe.searchParams.set('noaudio','');return safe.href;
}
export function cameraKeyPatch(state,key,shift=false){
 const step=(shift?.003:.02)/state.zoom;
 return {arrowleft:{x:state.x-step},arrowright:{x:state.x+step},arrowup:{y:state.y-step},arrowdown:{y:state.y+step},w:{zoom:state.zoom+.1},s:{zoom:state.zoom-.1},'+':{zoom:state.zoom+.1},'=':{zoom:state.zoom+.1},'-':{zoom:state.zoom-.1},r:{x:.5,y:.5,zoom:1}}[key.toLowerCase()];
}
export function normalize(s){if(typeof s!=='object'||!s)throw Error('Neplatná konfigurace');return {...crop(s),aspectRatio:aspect(s),source:s.source?sourceURL(s.source):'',smooth:s.smooth===true,venue:String(s.venue||'').slice(0,80),autoSettings:settings(s.autoSettings)};}
