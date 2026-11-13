import {crop,sourceURL,cameraKeyPatch} from './core.js';
import {setupAuto} from './auto-client.js';
let autoClient;
const $=id=>document.getElementById(id),isOutput=location.pathname.includes('/output');
let id,key,state={x:.5,y:.5,zoom:1,smooth:false,source:'',venue:''},received=performance.now(),operatorFresh=null,frame,loadedSource,dirty=false,sending=false,version=0,revision=1,mediaStatus='Bez zdroje',retryAt=0,connected=false,stopped=false,pollTimer;
const setText=(id,text)=>{if($(id))$(id).textContent=text;};
async function api(action='state',method='GET',body){const query=new URLSearchParams({action,...(id?{session:id}:{})});const r=await fetch('/api/virtual-camera?'+query,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(6500),...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});const data=await r.json();if(!r.ok){const e=Error(data.error||'Chyba spojení');e.status=r.status;throw e;}return data;}
function persist(){if(!isOutput)localStorage.setItem('hero-camera-session-v1',location.hash);}
function media(force=false){if(!force&&loadedSource===state.source)return;loadedSource=state.source;retryAt=0;$('media').replaceChildren();$('media').classList.toggle('demo',!state.source);
 if(!state.source){const img=document.createElement('img');img.src='/virtual-camera/demo.svg';img.alt='Ukázka hřiště bez živého videa';$('media').append(img);frame=null;mediaStatus='Bez zdroje';return;}
 frame=document.createElement('iframe');frame.title='Živý široký záběr VDO.Ninja';frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';frame.src=sourceURL(state.source,{audio:isOutput});frame.onload=()=>{mediaStatus='Stránka načtena; zkontrolujte živý obraz';};$('media').append(frame);mediaStatus='Připojuji VDO.Ninja…';
}
window.addEventListener('message',e=>{if(e.origin!=='https://vdo.ninja'||e.source!==frame?.contentWindow||!e.data||typeof e.data!=='object')return;if(e.data.action==='view-connection'){mediaStatus=e.data.value?'WebRTC spojeno (obraz zkontrolujte)':'WebRTC odpojeno; obnovuji…';retryAt=e.data.value?0:performance.now()+10000;}});
function controls(){if(isOutput)return;for(const field of ['source','venue'])if(document.activeElement!==$(field))$(field).value=state[field];$('smooth').checked=state.smooth;$('zoom').value=state.zoom;}
function accept(s,force=false){if(force)autoClient?.stop();received=performance.now();connected=true;setText('sync','Ovládání: připojeno');const age=s.serverNow-s.operatorAt;operatorFresh=s.operatorAt?performance.now()-Math.max(0,age):null;
 if(force||!dirty&&!sending){if(s.revision>=revision){state={...state,...s};revision=s.revision;media();controls();}}
 if(!isOutput&&s.outputKey){const u=new URL('/virtual-camera/output',location.origin);u.hash=new URLSearchParams({id,key:s.outputKey}).toString();$('outputURL').value=u.href;$('openOutput').href=u.href;}
 setText('obsStatus',s.serverNow-s.outputAt<7000?'OBS / výstup: '+s.outputStatus:'OBS / výstup: nepřipojen');
}
function failed(e){connected=false;setText('sync','Ovládání: výpadek — obnovuji…');if(!isOutput)setText('error',e.message);if([403,404].includes(e.status)){stopped=true;setText('sync','Přístup k relaci selhal — použijte Nová relace');}}
async function flush(){if(!dirty||sending||!id||stopped)return;sending=true;dirty=false;const v=version;try{const s=await api('state','PUT',{...state,revision});revision=s.revision;accept(s);if(v===version){setText('saved','Nastavení uloženo');setText('error','');}}catch(e){if(e.status===409){dirty=false;accept(await api(),true);setText('error',e.message);}else{dirty=true;failed(e);setText('saved','Neuloženo — čekám na spojení');}}finally{sending=false;}}
function change(patch,automatic=false){if(!automatic)autoClient?.stop();state={...state,...patch};Object.assign(state,crop(state));dirty=true;version++;controls();setText('saved','Ukládám…');}
async function poll(){if(stopped)return;try{const s=await api(isOutput?'state':'heartbeat',isOutput?'GET':'POST');accept(s);}catch(e){failed(e);}pollTimer=setTimeout(poll,isOutput?250:2000);}
async function init(){try{let hash=location.hash;if(!hash&&!isOutput)hash=localStorage.getItem('hero-camera-session-v1')||'';const p=new URLSearchParams(hash.replace(/^#/,''));id=p.get('id');key=p.get('key');if(!id||!key){if(isOutput)throw Error('Chybí výstupní klíč');const s=await api('create','POST');id=s.id;key=s.key;}location.hash=new URLSearchParams({id,key}).toString();persist();accept(await api(),true);setText('error','');poll();}catch(e){failed(e);setText('error',e.message);if(!stopped)setTimeout(init,3000);}}
if(!isOutput){$('sourceForm').onsubmit=e=>{e.preventDefault();try{const source=sourceURL($('source').value.trim());autoClient?.sourceChanged();change({source});media(true);setText('error','');}catch(e){setText('error',e.message);}};
 $('reconnect').onclick=()=>{autoClient?.sourceChanged();media(true);};$('zoom').oninput=e=>change({zoom:+e.target.value});document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>change({zoom:+b.dataset.zoom}));$('reset').onclick=()=>change({x:.5,y:.5,zoom:1});$('smooth').onchange=e=>change({smooth:e.target.checked});$('venue').onchange=e=>change({venue:e.target.value});
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('outputURL').value);setText('copy','Zkopírováno');}catch{setText('error','Označte a zkopírujte výstupní URL ručně.');}};
 $('newSession').onclick=()=>{localStorage.removeItem('hero-camera-session-v1');location.href='/virtual-camera';};
 const point=e=>{const r=$('wide').getBoundingClientRect();change({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});};let dragging=false;
 $('drag').onpointerdown=e=>{dragging=true;$('drag').setPointerCapture(e.pointerId);$('wide').focus();point(e);};$('drag').onpointermove=e=>{if(dragging)point(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('drag').addEventListener(event,()=>dragging=false);
 window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;const p=cameraKeyPatch(state,e.key,e.shiftKey);if(p){e.preventDefault();change(p);}});
}
const fallback=()=>operatorFresh===null||performance.now()-operatorFresh>8000||performance.now()-received>8000;
let display={x:.5,y:.5,zoom:1},last=performance.now();
function draw(now){const dt=Math.min(now-last,100);last=now;const target=isOutput&&fallback()?{x:.5,y:.5,zoom:1}:crop(state);const a=state.smooth?1-Math.exp(-dt/250):1;for(const k of ['x','y','zoom'])display[k]+=(target[k]-display[k])*a;display=crop(display);
 if(isOutput){const z=display.zoom;$('media').style.transform=`translate(${(0.5-display.x*z)*100}%,${(0.5-display.y*z)*100}%) scale(${z})`;}else{const c=crop(state);$('box').style.cssText=`width:${100/c.zoom}%;height:${100/c.zoom}%;left:${100*(c.x-.5/c.zoom)}%;top:${100*(c.y-.5/c.zoom)}%`;setText('zoomValue',c.zoom.toFixed(2)+'×');setText('videoStatus','Video: '+mediaStatus);setText('mode',mediaStatus.startsWith('Lokální')?'LOKÁLNÍ TEST / BEZ NAHRÁVÁNÍ':state.source?'VDO.NINJA / ŠIROKÝ VSTUP':'UKÁZKA BEZ VIDEA');}
 requestAnimationFrame(draw);
}
let reporting=false;setInterval(async()=>{if(!id||!key||stopped)return;if(isOutput&&!reporting){reporting=true;try{accept(await api('report','POST',{status:(fallback()?'Záložní široký · ':'Výřez · ')+mediaStatus}));}catch(e){failed(e);}finally{reporting=false;}}if(retryAt&&performance.now()>retryAt)media(true);},2000);
if(!isOutput)setInterval(()=>flush().catch(e=>failed(e)),180);
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(pollTimer);});
media();
if(!isOutput)autoClient=setupAuto({getState:()=>state,apply:change,getFrame:()=>frame,onTestVideo:video=>{$('media').replaceChildren(video);frame=null;mediaStatus='Lokální test (jen režie)';}});
requestAnimationFrame(draw);init().then(()=>autoClient?.sync());
