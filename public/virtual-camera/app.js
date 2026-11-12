import {crop,cropSize,aspect,OUTPUT_ASPECT,sourceURL,cameraKeyPatch,videoStats} from './core.js';
const $=id=>document.getElementById(id),isOutput=location.pathname.includes('/output');
let id,key,state={x:.5,y:.5,zoom:1,smooth:false,source:'',venue:''},received=performance.now(),operatorFresh=null,frame,loadedSource,dirty=false,sending=false,version=0,revision=1,mediaStatus='Bez zdroje',retryAt=0,connected=false,stopped=false,pollTimer;
const setText=(id,text)=>{if($(id))$(id).textContent=text;};
let videoAt=0,videoSignature='',delivered=null,localAspect=null,retryDelay=30000;
function status(text){mediaStatus=text;document.body.dataset.mediaStatus=text;setText('diagnostics',text);}
function message(data){frame?.contentWindow?.postMessage(data,'https://vdo.ninja');}
function requestStats(){message({getStats:true,cib:'hero-video'});}
async function api(action='state',method='GET',body){const query=new URLSearchParams({action,...(id?{session:id}:{})});const r=await fetch('/api/virtual-camera?'+query,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(6500),...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});const data=await r.json();if(!r.ok){const e=Error(data.error||'Chyba spojení');e.status=r.status;throw e;}return data;}
function persist(){if(!isOutput)localStorage.setItem('hero-camera-session-v1',location.hash);}
function media(force=false){if(!force&&loadedSource===state.source)return;const changed=loadedSource!==state.source;loadedSource=state.source;videoAt=0;videoSignature='';delivered=null;if(changed){localAspect=null;retryDelay=30000;}retryAt=0;$('media').replaceChildren();$('media').classList.toggle('demo',!state.source);
 if(!state.source){const img=document.createElement('img');img.src='/virtual-camera/demo.svg';img.alt='Ukázka hřiště bez živého videa';$('media').append(img);frame=null;status('Čekání na video · bez zdroje');return;}
 const current=document.createElement('iframe');frame=current;frame.title='Živý široký záběr VDO.Ninja';frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';
 frame.onload=()=>{if(frame!==current)return;status('Čekání na video · přijímač načten');requestStats();};
 frame.onerror=()=>{if(frame===current){status('Chyba · přijímač nelze načíst');retryAt=performance.now()+10000;}};
 try{frame.src=sourceURL(state.source,{audio:isOutput&&!!window.obsstudio});$('media').append(frame);status('Čekání na video · připojuji VDO.Ninja');retryAt=performance.now()+retryDelay;}catch{status('Chyba · neplatný zdroj');frame=null;}
}
window.addEventListener('message',e=>{if(e.origin!=='https://vdo.ninja'||e.source!==frame?.contentWindow||!e.data||typeof e.data!=='object')return;
 if(e.data.action==='view-connection'){status(e.data.value?'Čekání na video · WebRTC spojeno':'Odpojeno · obnovuji spojení');retryAt=performance.now()+(e.data.value?30000:10000);requestStats();}
 if(e.data.cib==='hero-video'&&e.data.stats){const v=videoStats(e.data.stats);if(!v)return;
  delivered=v;localAspect=v.width/v.height;
  if(!isOutput&&Math.abs(aspect(state)-localAspect)>.001)change({aspectRatio:localAspect});
  const signature=Number.isFinite(v.frames)?(v.frames>0?'f'+v.frames:null):Number.isFinite(v.stamp)?'t'+v.stamp:null;
  if(signature&&signature!==videoSignature){videoSignature=signature;videoAt=performance.now();retryDelay=30000;retryAt=videoAt+30000;status(`Připojeno · příjem ${v.width} × ${v.height}`);}
  else if(!videoAt)status(`Čekání na video · metadata ${v.width} × ${v.height}`);
 }
});
function controls(){if(isOutput)return;for(const field of ['source','venue'])if(document.activeElement!==$(field))$(field).value=state[field];$('smooth').checked=state.smooth;$('zoom').value=state.zoom;}
function accept(s,force=false){received=performance.now();connected=true;setText('sync','Ovládání: připojeno');const age=s.serverNow-s.operatorAt;operatorFresh=s.operatorAt?performance.now()-Math.max(0,age):null;
 if(force||!dirty&&!sending){if(s.revision>=revision){state={...state,...s};revision=s.revision;media();controls();}}
 if(!isOutput&&s.outputKey){const u=new URL('/virtual-camera/output',location.origin);u.hash=new URLSearchParams({id,key:s.outputKey}).toString();$('outputURL').value=u.href;$('openOutput').href=u.href;}
 setText('obsStatus',s.serverNow-s.outputAt<7000?'OBS / výstup: '+s.outputStatus:'OBS / výstup: nepřipojen');
}
function failed(e){connected=false;setText('sync','Ovládání: výpadek — obnovuji…');if(isOutput)setText('diagnostics','Chyba řízení · '+([403,404].includes(e.status)?'neplatný přístup':'obnovuji spojení'));if(!isOutput)setText('error',e.message);if([403,404].includes(e.status)){stopped=true;setText('sync','Přístup k relaci selhal — použijte Nová relace');}}
async function flush(){if(!dirty||sending||!id||stopped)return;sending=true;dirty=false;const v=version;try{const s=await api('state','PUT',{...state,revision});revision=s.revision;accept(s);if(v===version){setText('saved','Nastavení uloženo');setText('error','');}}catch(e){if(e.status===409){dirty=false;accept(await api(),true);setText('error',e.message);}else{dirty=true;failed(e);setText('saved','Neuloženo — čekám na spojení');}}finally{sending=false;}}
function change(patch){state={...state,...patch};Object.assign(state,crop(state));dirty=true;version++;controls();setText('saved','Ukládám…');}
async function poll(){if(stopped)return;try{const s=await api(isOutput?'state':'heartbeat',isOutput?'GET':'POST');accept(s);}catch(e){failed(e);}pollTimer=setTimeout(poll,isOutput?250:2000);}
async function init(){try{let hash=location.hash;const query=new URLSearchParams(location.search);if(!hash&&query.has('id')&&query.has('key')){hash=new URLSearchParams({id:query.get('id'),key:query.get('key')}).toString();query.delete('id');query.delete('key');history.replaceState(null,'',location.pathname+(query.size?'?'+query:'')+'#'+hash);}if(!hash&&!isOutput)hash=localStorage.getItem('hero-camera-session-v1')||'';const p=new URLSearchParams(hash.replace(/^#/,''));id=p.get('id');key=p.get('key');if(!id||!key){if(isOutput)throw Error('Chybí výstupní klíč');const s=await api('create','POST');id=s.id;key=s.key;}location.hash=new URLSearchParams({id,key}).toString();persist();accept(await api(),true);setText('error','');poll();}catch(e){failed(e);setText('error',e.message);if(!stopped)setTimeout(init,3000);}}
if(!isOutput){$('sourceForm').onsubmit=e=>{e.preventDefault();try{const source=sourceURL($('source').value.trim());change({source});media(true);setText('error','');}catch(e){setText('error',e.message);}};
 $('reconnect').onclick=()=>media(true);$('zoom').oninput=e=>change({zoom:+e.target.value});document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>change({zoom:+b.dataset.zoom}));$('reset').onclick=()=>change({x:.5,y:.5,zoom:1});$('smooth').onchange=e=>change({smooth:e.target.checked});$('venue').onchange=e=>change({venue:e.target.value});
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('outputURL').value);setText('copy','Zkopírováno');}catch{setText('error','Označte a zkopírujte výstupní URL ručně.');}};
 $('newSession').onclick=()=>{localStorage.removeItem('hero-camera-session-v1');location.href='/virtual-camera';};
 const point=e=>{const r=$('wide').getBoundingClientRect();change({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});};let dragging=false;
 $('drag').onpointerdown=e=>{dragging=true;$('drag').setPointerCapture(e.pointerId);$('wide').focus();point(e);};$('drag').onpointermove=e=>{if(dragging)point(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('drag').addEventListener(event,()=>dragging=false);
 window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;const p=cameraKeyPatch(state,e.key,e.shiftKey);if(p){e.preventDefault();change(p);}});
}
const fallback=()=>operatorFresh===null||performance.now()-operatorFresh>8000||performance.now()-received>8000;
let display={x:.5,y:.5,zoom:1},last=performance.now();
function draw(now){const dt=Math.min(now-last,100);last=now;const geometry={...state,aspectRatio:localAspect??aspect(state)},wideFallback=isOutput&&fallback();const target=wideFallback?{x:.5,y:.5,zoom:1}:crop(geometry);const a=state.smooth?1-Math.exp(-dt/250):1;for(const k of ['x','y','zoom'])display[k]+=(target[k]-display[k])*a;display=crop({...display,aspectRatio:aspect(geometry)});
 if(isOutput){const r=aspect(geometry),size=wideFallback?{width:Math.max(1,OUTPUT_ASPECT/r),height:Math.max(1,r/OUTPUT_ASPECT)}:cropSize({...display,aspectRatio:r});const x=wideFallback?.5:display.x,y=wideFallback?.5:display.y;
  $('media').style.cssText=`inset:auto;width:${100/size.width}%;height:${100/size.height}%;left:${50-x*100/size.width}%;top:${50-y*100/size.height}%`;
 }else{const c=crop(geometry),size=cropSize(geometry);$('wide').style.aspectRatio=aspect(geometry);$('box').style.cssText=`width:${100*size.width}%;height:${100*size.height}%;left:${100*(c.x-size.width/2)}%;top:${100*(c.y-size.height/2)}%`;setText('zoomValue',c.zoom.toFixed(2)+'×');setText('videoStatus','Video: '+mediaStatus);setText('mode',state.source?'VDO.NINJA / ŠIROKÝ VSTUP':'UKÁZKA BEZ VIDEA');}
 requestAnimationFrame(draw);
}
let reporting=false;setInterval(async()=>{if(stopped)return;requestStats();if(videoAt&&performance.now()-videoAt>10000)status('Odpojeno · nepřibývají snímky');if(retryAt&&performance.now()>retryAt){retryDelay=Math.min(60000,retryDelay*2);media(true);}if(!id||!key)return;if(isOutput&&!reporting){reporting=true;try{await api('report','POST',{status:(fallback()?'Záložní široký · ':'Výřez · ')+mediaStatus});}catch(e){failed(e);}finally{reporting=false;}}},2000);
if(!isOutput)setInterval(()=>flush().catch(e=>failed(e)),180);
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(pollTimer);});
media();requestAnimationFrame(draw);init();


