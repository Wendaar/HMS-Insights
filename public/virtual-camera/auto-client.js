import {AutoDirector,settings} from './auto.js';
export function setupAuto({getState,apply,getFrame,onTestVideo}) {
 const $=id=>document.getElementById(id),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 let enabled=false,director=new AutoDirector(getState()),packet=null,packetAt=0,busy=false,generation=0,lastRequest=0,pending=null,video=null,url=null,reset=true,lastVideoTime=-1,requestSequence=0;
 const status=text=>$('autoStatus').textContent=text;
 const cfg=()=>settings(getState().autoSettings);
 $('testVideo').disabled=!['localhost','127.0.0.1'].includes(location.hostname);
 function stop(){enabled=false;generation++;pending=null;packet=null;$('autoMode').value='MANUAL';status('MANUAL · ruční řízení');$('diagnostics').replaceChildren();}
 function restart(){generation++;packet=null;pending=null;reset=true;lastVideoTime=-1;director.reset(getState());}
 function sync(){const s=cfg();$('sensitivity').value=s.sensitivity;$('preferredZoom').value=s.preferredZoom;for(const k of Object.keys(s.calibration))$(`cal-${k}`).value=s.calibration[k];}
 $('autoMode').onchange=()=>{enabled=$('autoMode').value==='AUTO';restart();if(enabled)status('AUTO · čekám na obraz a lokální analyzátor');else stop();};
 $('takeManual').onclick=stop;
 for(const name of ['sensitivity','preferredZoom'])$(name).onchange=()=>apply({autoSettings:{...cfg(),[name]:+$(name).value}},true);
 for(const k of Object.keys(cfg().calibration))$(`cal-${k}`).onchange=()=>{apply({autoSettings:{...cfg(),calibration:{...cfg().calibration,[k]:+$(`cal-${k}`).value}}},true);sync();restart();};
 $('testVideo').onchange=()=>{const file=$('testVideo').files[0];if(!file)return;stop();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);video=document.createElement('video');video.src=url;video.controls=true;video.muted=true;video.playsInline=true;onTestVideo(video);video.addEventListener('seeking',restart);video.addEventListener('timeupdate',()=>{if(document.activeElement!==$('testSeek'))$('testSeek').value=video.duration?video.currentTime/video.duration:0;});video.play().catch(()=>{});status('Lokální test · obraz jen v režii; OBS používá živý zdroj');};
 $('testPause').onclick=()=>{if(video){if(video.paused)video.play().catch(()=>{});else video.pause();}};
 $('testSeek').oninput=()=>{if(video&&Number.isFinite(video.duration))video.currentTime=+$('testSeek').value*video.duration;};
 async function analyze(blob,epoch){if(busy||!enabled)return;busy=true;try{
  const r=await fetch('http://127.0.0.1:8766/analyze',{method:'POST',headers:{'Content-Type':'image/jpeg',...(reset?{'X-Camera-Reset':'1'}:{})},body:blob,signal:AbortSignal.timeout(2500)});
  if(!r.ok)throw Error('Analyzátor HTTP '+r.status);const data=await r.json();
  if(epoch!==generation||!enabled)return;if(!Array.isArray(data.tracks))throw Error('Neplatná odpověď analyzátoru');packet=data;packetAt=performance.now();reset=false;
 }catch(e){if(epoch===generation&&enabled)status('AUTO · '+e.message+' · obnovuji, bezpečný záběr');}finally{busy=false;}}
 async function sample(image,epoch){try{const w=image.videoWidth||image.width,h=image.videoHeight||image.height;if(!w||!h)return;canvas.width=Math.min(w,1920);canvas.height=Math.round(h*canvas.width/w);ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(blob&&epoch===generation)await analyze(blob,epoch);}catch(e){status('AUTO · obraz nelze analyzovat: '+e.message);}finally{image.close?.();}}
 window.addEventListener('message',async e=>{if(e.origin!=='https://vdo.ninja'||e.source!==getFrame()?.contentWindow||!enabled||e.data?.type!=='frame'||!pending||e.data.cib!==pending.token)return;
  const epoch=pending.epoch;pending=null;
  if(typeof e.data.frame!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(e.data.frame)||e.data.frame.length>6000000)return;
  try{const img=new Image();img.src=e.data.frame;await img.decode();if(epoch===generation)await sample(img,epoch);}catch{status('AUTO · neplatný snímek');}
 });
 const timer=setInterval(()=>{
  if(!enabled)return;const now=performance.now();
  const result=director.update(now-packetAt<1200?packet:null,now/1000,cfg());apply({x:result.x,y:result.y,zoom:result.zoom,smooth:true},true);
  if(packet&&now-packetAt<1200)status(`${result.trackingState} · jistota ${Math.round(result.confidence*100)} % · ${Math.round(packet.analysisMs)} ms · ${result.reason}`);
  else if(now-packetAt>2500)status('AUTO · bez čerstvé analýzy, bezpečný široký záběr');
  $('diagnostics').replaceChildren();if($('showDiagnostics').checked){for(const t of result.tracks){const b=document.createElement('i');b.style.cssText=`left:${t.box[0]*100}%;top:${t.box[1]*100}%;width:${t.box[2]*100}%;height:${t.box[3]*100}%`;b.textContent=t.id;$('diagnostics').append(b);}const b=document.createElement('b');b.style.left=`${result.targetX*100}%`;$('diagnostics').append(b);}
  if(busy||now-lastRequest<400)return;
  if(video){if(video.paused||video.ended||video.currentTime===lastVideoTime)return;lastVideoTime=video.currentTime;lastRequest=now;sample(video,generation);}
  else {if(pending&&now-lastRequest<1800)return;const frame=getFrame();if(frame){lastRequest=now;const token=`hero-${generation}-${++requestSequence}`;pending={token,epoch:generation};frame.contentWindow.postMessage({getSnapshotByStreamID:new URL(getState().source).searchParams.get('view'),cib:token},'https://vdo.ninja');}}
 },250);
 window.addEventListener('pagehide',()=>{clearInterval(timer);stop();if(url)URL.revokeObjectURL(url);});
 sync();return {stop,sync,sourceChanged(){stop();video=null;restart();}};
}
