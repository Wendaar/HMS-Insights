import {resolveInsightSubject,insightLabel,insightStat} from './subjects.js';
import {fonts,brandFonts,fontForText,fontSpec} from './typography.js';
export {fonts} from './typography.js';
import {sportingImage} from '../game-report-media.js';
export const formats={'1:1':[1080,1080],'9:16':[1080,1920]};
export const designs=['clean','crazy','artistic','technical','pantha'];
export function safeArea(format){return format==='9:16'?{x:96,y:220,w:864,h:1360}:{x:64,y:64,w:952,h:952};}
export function imageSources(game,insight,settings){const subject=resolveInsightSubject(game,insight);return {background:settings.background,home:game.home.logoUrl,away:game.away.logoUrl,organization:game.organizationLogoUrl,competition:settings.competitionLogo||game.competitionLogoUrl,group:settings.groupLogo||game.groupLogoUrl,phase:game.phaseLogoUrl,partner:settings.partnerLogo,player:subject?.playerId?(settings.playerPhoto||subject.photoUrl):null,subjectTeam:subject?.teamLogoUrl};}
export function templates(game) {
  if(!game) return [];
  const scored = [game.home?.score,game.away?.score].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
  const result=[];
  if(game.status==='FINISHED'&&scored) result.push({id:'final',label:'Final Score',heading:'KONEČNÝ VÝSLEDEK',home:game.home.score,away:game.away.score});
  if(['FINISHED','RUNNING'].includes(game.status)&&game.timeline?.coverage==='matches-result') {
    const periods=game.timeline.periodScores??[];
    for(const p of periods) {
      if(game.status!=='FINISHED' && !(p.period<game.currentPeriod))continue;
      result.push({id:`period-${p.period}`,label:`End of Period · ${p.period}`,heading:p.period<=3?`PO ${p.period}. TŘETINĚ`:`PO ${p.period}. ČÁSTI`,home:periods.filter(x=>x.period<=p.period).reduce((n,x)=>n+x.home,0),away:periods.filter(x=>x.period<=p.period).reduce((n,x)=>n+x.away,0)});
    }
  }
  return result;
}
// Reuse stored achievements and official HMS stars, never infer awards from points.
export function gameOutputs(game){
  const result=templates(game);
  if(game?.status!=='FINISHED')return result;
  for(const p of game.priklepy??[]){
    if(!['HATTRICK','MULTIPOINT_GAME','BIG_SAVES','EARLY_GOAL','BIG_WIN'].includes(p.type))continue;
    const id=p.id?.split(':').at(-1),player=[...game.players??[],...game.goalies??[]].find(x=>x.id?.toLowerCase()===id?.toLowerCase());
    const team=[game.home,game.away].find(x=>x.id?.toLowerCase()===id?.toLowerCase());
    if(!player&&!team)continue;
    const insight={...p,gameId:game.gameId,playerId:player?.id,player:player?.name,teamId:player?.teamId??team?.id,team:team?.name};
    result.push({id:`moment-${p.id}`,label:`${insightLabel(p.type)} · ${player?.name??team.name}`,insight});
  }
  for(const star of game.stars??[]){
    if(![...game.players??[],...game.goalies??[]].some(p=>p.id?.toLowerCase()===star.id?.toLowerCase()&&p.teamId?.toLowerCase()===star.teamId?.toLowerCase()))continue;
    result.push({id:`star-${star.id}`,label:`Star of the Match · ${star.name}`,insight:{gameId:game.gameId,type:'OFFICIAL_STAR',title:'Star of the Match',playerId:star.id,player:star.name,teamId:star.teamId,text:'Oficiální hvězda zápasu dle HMS.'}});
  }
  return result;
}
export function exportFilename(game,template,settings,insight=null){
  const label=insight?insightLabel(insight.type):template?.label||'Game';
  const subject=insight?resolveInsightSubject(game,insight)?.playerName:null;
  const clean=v=>String(v??'').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
  return [game.org,game.playedOn,label,subject,game.home.name,game.away.name,settings.format?.replace(':','x'),({clean:'Clean',crazy:'Crazy',artistic:'Artistic',technical:'Technical',pantha:'Pantha'}[settings.design]??settings.design)].filter(Boolean).map(clean).join(' ').slice(0,220).trim()+'.png';
}
export function publicImageUrl(value) {
  try {const u=new URL(value);const h=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||u.username||u.password||u.port||h==='localhost'||!h.includes('.')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localhost')||h.includes(':')||/^\d/.test(h)||h.endsWith('.test'))return null;
    return u.href;
  }catch{return null;}
}
export async function loadImage(url,{required=false}={}) {
  if(!url)return null;
  if(!url.startsWith('data:image/')&&!publicImageUrl(url)) {if(required)throw new Error('Použijte veřejnou HTTPS adresu obrázku.');return null;}
  try {
    // Same-origin HMS bridge keeps preview authentication; external hosts get no credentials.
    const source=sportingImage(url);
    const fetchUrl=source?'/api/studio-image?'+new URLSearchParams({url:source}):url;
    const r=await fetch(fetchUrl,{mode:'cors',credentials:source?'same-origin':'omit',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error();
    const blob=await r.blob();
    if(blob.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error();
    const image=await createImageBitmap(blob);
    if(image.width*image.height>40000000){image.close();throw new Error();}
    return image;
  }catch {if(required)throw new Error('Obrázek nelze načíst (CORS, formát nebo velikost). Nahrajte PNG/JPG/WebP do 8 MB.');return null;}
}
function fit(ctx,text,x,y,width,size,font,color,align='center') {
  text=String(text??'').normalize('NFC').slice(0,300);font=fontForText(font,text);ctx.textAlign=align;ctx.fillStyle=color;
  let s=size;do{ctx.font=fontSpec(font,s,text);if(ctx.measureText(text).width<=width)break;s-=2;}while(s>20);
  if(ctx.measureText(text).width>width){const suffix=font==='Pantha'?'...':'…';while(text.length&&ctx.measureText(text+suffix).width>width)text=[...text].slice(0,-1).join('');text+=suffix;}
  ctx.fillText(text,x,y);
}
function cover(ctx,img,x,y,w,h){const r=Math.max(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*r)/2,y+(h-img.height*r)/2,img.width*r,img.height*r);}
function panel(ctx,x,y,w,h,r=24){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function stripes(ctx,color,x,y,width){ctx.fillStyle=color;for(let i=0;i<8;i++){const a=x+i*75;ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(a+35,y);ctx.lineTo(a+65,y+30);ctx.lineTo(a+30,y+30);ctx.fill();}}
function teamBadge(ctx,img,name,x,y,size,font){
  ctx.save();ctx.shadowColor='#00000050';ctx.shadowBlur=30;ctx.shadowOffsetY=12;
  ctx.fillStyle='#fff9ed';panel(ctx,x-size*.62,y-size*.62,size*1.24,size*1.24,30);ctx.fill();ctx.restore();
  logo(ctx,img,name,x,y,size,font);
}
function lines(ctx,text,x,y,width,size,font,color,maxLines=3){
  font=fontForText(font,text);ctx.font=fontSpec(font,size,text);const words=String(text??'').split(/\s+/);let line='',rows=[];
  for(const word of words){if(line&&ctx.measureText(line+' '+word).width>width){rows.push(line);line=word;}else line+=(line?' ':'')+word;}
  if(line)rows.push(line);rows.slice(0,maxLines).forEach((row,i)=>fit(ctx,row,x,y+i*size*1.22,width,size,font,color,'left'));
}
function logo(ctx,img,label,x,y,size,font) {
  if(img){const r=Math.min(size/img.width,size/img.height);ctx.drawImage(img,x-img.width*r/2,y-img.height*r/2,img.width*r,img.height*r);}
  else {ctx.fillStyle='#132c43';ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();fit(ctx,String(label??'?').split(/\s+/).map(x=>x[0]).join('').slice(0,3),x,y+18,size*.85,48,font,'#fff');}
}
function plate(c,x,y,w,h,fill,stroke=null,r=24){
  c.save();c.shadowColor='#00000065';c.shadowBlur=30;c.shadowOffsetY=14;
  c.fillStyle=fill;panel(c,x,y,w,h,r);c.fill();c.restore();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=2;panel(c,x,y,w,h,r);c.stroke();}
}
function effects(c,w,h,accent,crazy){
  const g=c.createRadialGradient(w*.75,h*.35,0,w*.75,h*.35,w);g.addColorStop(0,accent+'45');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,w,h);
  if(!crazy)return;
  c.save();c.globalCompositeOperation='screen';
  for(const [x,y,color] of [[w*.06,h*.03,'#5f8fff'],[w*.93,h*.09,accent],[w*.80,h*.72,'#754aff']]){
    const glow=c.createRadialGradient(x,y,0,x,y,w*.55);glow.addColorStop(0,color+'b0');glow.addColorStop(.20,color+'38');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.strokeStyle='#ffffffa0';c.lineWidth=2;c.beginPath();c.moveTo(x-35,y);c.lineTo(x+35,y);c.moveTo(x,y-35);c.lineTo(x,y+35);c.stroke();
  }
  for(let i=0;i<7;i++){c.strokeStyle=i%2?accent+'75':'#73aaff40';c.lineWidth=i%3+1;c.beginPath();c.moveTo(-w*.15,h*.15+i*65);c.lineTo(w*1.1,h*.6+i*52);c.stroke();}
  for(let i=0;i<90;i++){const x=((i*193+37)%997)/997*w,y=((i*347+19)%991)/991*h;c.fillStyle=i%3?accent+'85':'#ffffffb0';c.fillRect(x,y,i%4+1,i%4+1);}
  c.restore();
}
function laurels(c,x,y,r){
  c.save();c.strokeStyle='#dfbd70b0';c.fillStyle='#dfbd7090';c.lineWidth=2;
  for(const side of [-1,1]){c.beginPath();c.ellipse(x,y,r*.89,r,0,side<0?Math.PI*.58:Math.PI*1.52,side<0?Math.PI*1.48:Math.PI*2.42);c.stroke();
    for(let i=0;i<12;i++){const a=(side<0?Math.PI*.62:Math.PI*1.56)+i*.22;c.save();c.translate(x+Math.cos(a)*r*.89,y+Math.sin(a)*r);c.rotate(a+side*.65);c.beginPath();c.ellipse(0,0,7,18,0,0,Math.PI*2);c.fill();c.restore();}}
  c.restore();
}
function designAtmosphere(c,w,h,artistic,technical,accent){
  if(artistic){
    const gold=c.createRadialGradient(w*.58,h*.44,0,w*.58,h*.44,w*.8);gold.addColorStop(0,'#d6a34765');gold.addColorStop(.5,'#6b402520');gold.addColorStop(1,'#00000000');c.fillStyle=gold;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<18;i++){c.fillStyle=i%2?'#ffe2a508':'#f9db9712';c.beginPath();c.moveTo(w*.65,h*.45);const a=i*.35;c.lineTo(w*.65+Math.cos(a)*h,h*.45+Math.sin(a)*h);c.lineTo(w*.65+Math.cos(a+.07)*h,h*.45+Math.sin(a+.07)*h);c.fill();}
    for(let i=0;i<125;i++){c.fillStyle=i%3?'#e9c56e80':'#fff1c6b0';c.beginPath();c.arc((i*193%1069),((i*353)%1913)/1920*h,i%3+1,0,Math.PI*2);c.fill();}c.restore();
    c.strokeStyle='#e3c17b80';c.lineWidth=2;c.strokeRect(36,36,w-72,h-72);c.strokeStyle='#e3c17b25';c.strokeRect(44,44,w-88,h-88);
  }
  if(technical){
    c.fillStyle='#02081270';c.fillRect(0,0,w,h);c.strokeStyle=accent+'18';c.lineWidth=1;
    for(let x=0;x<w;x+=54){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=54){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.save();c.globalCompositeOperation='screen';const beam=c.createLinearGradient(0,h, w,0);beam.addColorStop(0,'#00000000');beam.addColorStop(.48,accent+'00');beam.addColorStop(.50,accent+'60');beam.addColorStop(.54,accent+'00');beam.addColorStop(1,'#00000000');c.fillStyle=beam;c.fillRect(0,0,w,h);c.restore();
    c.strokeStyle=accent+'b0';c.lineWidth=3;for(const [x,y,sx,sy] of [[40,40,1,1],[w-40,40,-1,1],[40,h-40,1,-1],[w-40,h-40,-1,-1]]){c.beginPath();c.moveTo(x+sx*45,y);c.lineTo(x,y);c.lineTo(x,y+sy*45);c.stroke();}
  }
}
function transparentPortrait(image){const c=document.createElement('canvas');c.width=8;c.height=8;const x=c.getContext('2d');x.drawImage(image,0,0,8,8);const d=x.getImageData(0,0,8,8).data;return [3,31,227,255].some(i=>d[i]<240);}
export function panelPalette(settings={}){
  const color=/^#[a-f0-9]{6}$/i.test(settings.panelColor)?settings.panelColor:'#10243b';
  const n=Number(settings.panelOpacity??90),opacity=Math.max(0,Math.min(100,Number.isFinite(n)?n:90))/100;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const fill=`rgba(${rgb.join(',')},${opacity})`;
  const light=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  const onLight=opacity>.45&&light[0]*.2126+light[1]*.7152+light[2]*.0722>.45;
  return {fill,text:onLight?'#102030':'#ffffff',muted:onLight?'#263d50':'#d9e5f5'};
}
function statTile(c,value,label,x,y,w,h,font,accent,crazy,palette,numberFont='Anton'){
  plate(c,x,y,w,h,palette.fill,accent+'90',16);
  fit(c,String(value),x+w*.5,y+h*.59,w-20,h*.55,numberFont,palette.text);
  fit(c,label,x+w*.5,y+h*.86,w-18,Math.min(25,h*.18),font,palette.text==='#102030'?palette.muted:accent);
}
function badgePlate(c,img,label,x,y,size,font,crazy=false){
  c.save();c.shadowColor=crazy?'#55aaff80':'#00000075';c.shadowBlur=crazy?40:30;c.shadowOffsetY=12;
  c.fillStyle='#f7f5ee';panel(c,x-size*.59,y-size*.59,size*1.18,size*1.18,24);c.fill();c.restore();logo(c,img,label,x,y,size,font);
}
export async function renderGraphic(canvas,game,template,settings,insight=null) {
  const [w,h]=formats[settings.format]??formats['1:1'],area=safeArea(settings.format);
  const story=h>w,pantha=settings.design==='pantha',crazy=['crazy','pantha'].includes(settings.design),artistic=settings.design==='artistic',technical=settings.design==='technical',font=fonts.includes(settings.font)?settings.font:fonts[0];
  const palette=panelPalette(settings);
  const subject=resolveInsightSubject(game,insight),stat=insightStat(subject),accent=/^#[a-f0-9]{6}$/i.test(settings.accent)?settings.accent:'#79dfca';
  const sample=[game.home.name,game.away.name,game.competition,game.group,game.phase,template.heading,insight?.title,insight?.text,subject?.playerName,subject?.teamName,settings.partner,'Příliš žluťoučký kůň'].filter(Boolean).join(' ');
  const loaded=await Promise.all([...(artistic?[document.fonts.load('bold 80px "Noto Serif"',sample)]:[]),document.fonts.load(fontSpec(font,48),sample),...((brandFonts.includes(font)||pantha)?[document.fonts.load(fontSpec('Hitch Grotesk',48),sample),document.fonts.load(fontSpec('Noto Sans',48),sample)]:[]),...(pantha?[document.fonts.load(fontSpec('Pantha',80),'HATTRICK HERO FINAL 0123456789')]:[]),document.fonts.load('400 80px "Anton"',sample),document.fonts.load('400 80px "Permanent Marker"','HATTRICK HERO BIG WIN THE WALL FAST START POINT MACHINE FINAL')]);
  if(loaded.some(faces=>!faces.length))throw new Error('Font se nepodařilo načíst. Obnovte stránku a zkuste export znovu.');
  await document.fonts.ready;
  const sources=imageSources(game,insight,settings),keys=Object.keys(sources),pictures=await Promise.all(keys.map(k=>loadImage(sources[k],{required:!!sources[k]&&['background','partner','player'].includes(k)&&!!(k!=='player'||settings.playerPhoto)})));
  const im=Object.fromEntries(keys.map((k,i)=>[k,pictures[i]]));
  try {
    canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
    c.fillStyle=settings.base||'#091629';c.fillRect(0,0,w,h);
    if(im.background)cover(c,im.background,0,0,w,h);
    else {const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#071529');g.addColorStop(.5,settings.base||'#102c43');g.addColorStop(1,crazy?'#111337':'#061321');c.fillStyle=g;c.fillRect(0,0,w,h);}
    const shade=Number(settings.shade)||0;c.fillStyle=shade<0?`rgba(255,255,255,${-shade/100})`:`rgba(0,0,0,${shade/100})`;c.fillRect(0,0,w,h);
    effects(c,w,h,accent,crazy);
    designAtmosphere(c,w,h,artistic,technical,accent);
    if(pantha){c.save();c.translate(w*.5,h*.5);c.rotate(-.16);c.fillStyle=accent+'30';c.fillRect(-w,h*.10,w*2,story?135:90);c.fillStyle='#ffffff14';c.fillRect(-w,h*.10-20,w*2,8);c.restore();}
    // Everything semantic is contained inside a conservative social safe area.
    c.save();c.translate(area.x,area.y);c.beginPath();c.rect(0,0,area.w,area.h);c.clip();
    const W=area.w,H=area.h,pad=26,headerH=story?124:108,brandH=86,heroY=headerH+brandH+30;
    const heroH=insight?(story?620:360):(story?545:340),bottomY=heroY+heroH+20;
    // A full partner plate makes even wide wordmark logos readable.
    plate(c,4,3,W-8,headerH-4,'#f4f1e8',crazy?accent+'a0':null,24);
    if(settings.partner||im.partner){
      const width=im.partner?Math.min(W*.43,330):0;
      if(im.partner){const r=Math.min(width/im.partner.width,(headerH-38)/im.partner.height);c.drawImage(im.partner,pad,headerH/2-im.partner.height*r/2,im.partner.width*r,im.partner.height*r);}
      if(im.partner){fit(c,settings.partner||'PARTNER',W-pad,headerH*.54,W*.48,story?40:34,font,'#112238','right');fit(c,'PŘINÁŠÍ',W-pad,headerH*.80,W*.48,18,font,'#637184','right');}
      else {fit(c,settings.partner||'PARTNER',pad,headerH*.65,W*.65,54,font,'#112238','left');fit(c,'PŘINÁŠÍ',W-pad,headerH*.61,W*.3,22,font,'#637184','right');}
    }else{
      if(im.organization)logo(c,im.organization,'',pad+44,headerH/2,82,font);
      fit(c,game.org,im.organization?pad+106:pad,headerH*.58,W*.5,45,font,'#112238','left');
      fit(c,insight?'GAME MOMENTS':template.id==='final'?'FINAL SCORE':'END OF PERIOD',W-pad,headerH*.58,W*.5,29,font,'#112238','right');
    }
    // Competition and group are separate brands, with explicit name fallback.
    const brandY=headerH+20;
    for(const [i,key,label] of [[0,'competition',game.competition],[1,'group',game.group]]){
      const bx=i*(W/2);plate(c,bx+4,brandY,W/2-12,brandH,palette.fill,'#ffffff20',14);
      if(im[key]){c.fillStyle='#f7f7f0';panel(c,bx+14,brandY+8,70,70,10);c.fill();logo(c,im[key],'',bx+49,brandY+43,60,font);}
      fit(c,label||'HMS',bx+(im[key]?100:20),brandY+51,W/2-(im[key]?122:38),24,font,palette.text,'left');
    }
    // Main card: strong foreground shadow and an illuminated accent edge.
    plate(c,4,heroY,W-8,heroH,palette.fill,crazy?accent+'a0':artistic?'#dfbd70b0':technical?accent+'a0':'#ffffff28',technical?4:28);
    c.save();panel(c,4,heroY,W-8,heroH,28);c.clip();effects(c,W,heroY+heroH,accent,crazy);
    if(technical){c.fillStyle=accent;fit(c,'/// MATCH DATA',28,heroY+28,W*.45,17,font,accent,'left');}
    if(insight){
      const headline=insightLabel(insight.type),words=headline.split(' '),titleFont=pantha?'Pantha':crazy?'Permanent Marker':artistic?'Noto Serif':'Anton';
      const photoW=W*(crazy?.56:.53),photoH=heroH*(crazy?.84:.80),px=W-photoW-20,py=heroY+heroH-photoH;
      const portraitR=Math.min(photoW*.42,heroH*.32),portraitX=px+photoW/2,portraitY=heroY+heroH*.55;
      if(artistic){laurels(c,portraitX,portraitY,portraitR+14);}
      if(artistic&&im.player){
        c.save();c.beginPath();c.arc(portraitX,portraitY,portraitR,0,Math.PI*2);c.clip();
        if(transparentPortrait(im.player)){const r=Math.min(portraitR*2/im.player.width,portraitR*2/im.player.height);c.drawImage(im.player,portraitX-im.player.width*r/2,portraitY+portraitR-im.player.height*r,im.player.width*r,im.player.height*r);}
        else cover(c,im.player,portraitX-portraitR,portraitY-portraitR,portraitR*2,portraitR*2);c.restore();
      }else if(im.player){
        const cutout=transparentPortrait(im.player);
        c.save();c.shadowColor=crazy?accent+'b0':'#00000095';c.shadowBlur=crazy?45:28;c.shadowOffsetY=12;
        if(cutout){const r=Math.min(photoW/im.player.width,photoH/im.player.height);c.drawImage(im.player,px+(photoW-im.player.width*r)/2,py+photoH-im.player.height*r,im.player.width*r,im.player.height*r);}
        else {c.fillStyle='#f3f0e7';panel(c,px,py,photoW,photoH,22);c.fill();c.restore();c.save();panel(c,px,py,photoW,photoH,22);c.clip();cover(c,im.player,px,py,photoW,photoH);}c.restore();
      }else if(im.subjectTeam)badgePlate(c,im.subjectTeam,subject?.teamName,px+photoW/2,heroY+heroH*.52,Math.min(photoW*.74,260),font,crazy);
      else {fit(c,'FOTOGRAFIE',px+photoW/2,heroY+heroH*.50,photoW-20,27,font,'#a8bcd2');fit(c,'NENÍ K DISPOZICI',px+photoW/2,heroY+heroH*.59,photoW-20,21,font,'#8197af');}
      const tx=30,headlineW=W*.50-35;
      c.save();if(pantha){c.shadowColor=accent+'85';c.shadowBlur=14;}if(crazy){c.translate(tx,heroY+70);c.rotate(-.075);}else c.translate(tx,heroY+65);
      fit(c,words[0],0,pantha?(story?65:40):(story?50:25),headlineW,pantha?(story?170:110):(story?86:60),titleFont,palette.text,'left');
      fit(c,words.slice(1).join(' '),0,pantha?(story?180:128):(story?155:105),headlineW,pantha?(story?180:118):(story?92:66),titleFont,artistic?(palette.text==='#102030'?'#73520c':'#ebcf91'):(palette.text==='#102030'?palette.muted:accent),'left');c.restore();
      if(stat)statTile(c,stat.value,stat.label,30,heroY+heroH-(story?230:145),Math.min(210,W*.32),story?200:125,font,accent,crazy,palette,pantha?'Pantha':'Anton');
      if(crazy){c.fillStyle=accent+'ce';c.beginPath();c.moveTo(0,heroY+heroH-12);c.lineTo(W*.52,heroY+heroH-60);c.lineTo(W*.60,heroY+heroH);c.lineTo(0,heroY+heroH);c.fill();}
    }else{
      fit(c,template.id==='final'?'FINAL':template.heading,W/2,heroY+(story?140:88),W-70,template.id==='final'?(story?132:92):(story?60:46),template.id==='final'?(pantha?'Pantha':crazy?'Permanent Marker':artistic?'Noto Serif':'Anton'):font,palette.text);
      const ly=heroY+heroH*(artistic?.62:.65),size=artistic?(story?190:145):(story?208:165);
      if(artistic){laurels(c,W*.27,ly,size*.74);laurels(c,W*.73,ly,size*.74);}
      badgePlate(c,im.home,game.home.name,W*.27,ly,size,font,crazy);badgePlate(c,im.away,game.away.name,W*.73,ly,size,font,crazy);
      fit(c,'VS',W/2,ly+11,90,32,font,palette.text==='#102030'?palette.muted:accent);
    }
    c.restore();
    const footerY=H-64;
    if(insight){
      const name=subject?.playerName||subject?.teamName||insight.player||insight.team||'GAME MOMENT';
      const logoSize=story?100:78,logoX=W-logoSize*.65-8;
      if(im.subjectTeam)badgePlate(c,im.subjectTeam,subject?.teamName,logoX,bottomY+58,logoSize,font,crazy);
      fit(c,name.toUpperCase(),12,bottomY+55,W-(im.subjectTeam?160:30),story?68:52,font,'#fff','left');
      fit(c,subject?.teamName||'Tým nelze ověřit',12,bottomY+99,W-170,30,font,accent,'left');
      // Keep match context and achievement text readable even without a photo.
      const context=`${game.home.name}  ${game.home.score??'–'}:${game.away.score??'–'}  ${game.away.name}`;
      fit(c,context,12,bottomY+145,W-24,story?29:24,font,'#d9e5f5','left');
      lines(c,insight.text,12,bottomY+195,W-24,story?27:23,font,'#9eafc5',story?3:2);
    }else{
      plate(c,4,bottomY,W-8,story?270:230,palette.fill,accent+'75',24);
      const sy=bottomY+(story?167:139);
      fit(c,String(template.home),W*.27,sy,W*.40,story?175:150,pantha?'Pantha':'Anton',palette.text);fit(c,':',W/2,sy-6,70,88,font,palette.text==='#102030'?palette.muted:accent);
      fit(c,String(template.away),W*.73,sy,W*.40,story?175:150,pantha?'Pantha':'Anton',palette.text);
      fit(c,game.home.name,W*.27,sy+55,W*.44,30,font,palette.muted);fit(c,game.away.name,W*.73,sy+55,W*.44,30,font,palette.muted);
      const periods=game.timeline?.coverage==='matches-result'?game.timeline.periodScores:[];
      if(periods?.length&&template.id==='final')fit(c,periods.map(p=>`${p.home}:${p.away}`).join(' / '),W/2,bottomY+(story?320:270),W-30,26,font,'#9eb2cd');
    }
    c.fillStyle=accent;c.fillRect(12,footerY-20,W-24,3);
    fit(c,[game.playedOn,game.phase].filter(Boolean).join(' / '),12,footerY+22,W-210,23,font,'#9eafc5','left');
    for(const [i,key] of ['organization','phase'].filter(k=>im[k]).entries())logo(c,im[key],'',W-42-i*78,footerY+8,60,font);
    c.restore();
    const names={home:'Logo domácích',away:'Logo hostů',organization:'Logo organizace',competition:'Logo soutěže',group:'Logo skupiny',phase:'Logo fáze',player:'Fotografie hráče',subjectTeam:'Logo týmu hráče'};
    const warnings=keys.flatMap(k=>sources[k]&&!im[k]?[`${names[k]||k} se nepodařilo načíst.`]:[]);
    if(insight&&subject?.playerId&&!im.player)warnings.push('Fotografie hráče není dostupná. Můžete nahrát vlastní pro tento konkrétní výkon.');
    if(insight&&!subject?.identityAvailable)warnings.push('Vazbu hráče/týmu nelze plně ověřit; žádný náhradní domácí tým se nepoužívá.');
    return warnings;
  }finally{pictures.forEach(p=>p?.close());}
}
