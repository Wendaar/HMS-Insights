import {sportingImage} from '../game-report-media.js';
export const formats={'1:1':[1080,1080],'9:16':[1080,1920]};
export const fonts=['Roboto Condensed','Roboto','Roboto Slab','Noto Sans','Noto Serif'];
export function templates(game) {
  if(!game) return [];
  const scored = [game.home?.score,game.away?.score].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
  const result=[];
  if(game.status==='FINISHED'&&scored) result.push({id:'final',label:'Final Score',heading:'KONEČNÝ VÝSLEDEK',home:game.home.score,away:game.away.score});
  if(game.timeline?.coverage==='matches-result') {
    const periods=game.timeline.periodScores??[];
    for(const p of periods) {
      if(game.status!=='FINISHED' && !(p.period<game.currentPeriod))continue;
      result.push({id:`period-${p.period}`,label:`End of Period · ${p.period}`,heading:p.period<=3?`PO ${p.period}. TŘETINĚ`:`PO ${p.period}. ČÁSTI`,home:periods.filter(x=>x.period<=p.period).reduce((n,x)=>n+x.home,0),away:periods.filter(x=>x.period<=p.period).reduce((n,x)=>n+x.away,0)});
    }
  }
  return result;
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
    // Browser-only CORS fetch. There is deliberately no server image proxy.
    const source=sportingImage(url);
    const fetchUrl=source?'/api/studio-image?'+new URLSearchParams({url:source}):url;
    const r=await fetch(fetchUrl,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error();
    const blob=await r.blob();
    if(blob.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error();
    const image=await createImageBitmap(blob);
    if(image.width*image.height>40000000){image.close();throw new Error();}
    return image;
  }catch {if(required)throw new Error('Obrázek nelze načíst (CORS, formát nebo velikost). Nahrajte PNG/JPG/WebP do 8 MB.');return null;}
}
function fit(ctx,text,x,y,width,size,font,color,align='center') {
  text=String(text??'').slice(0,300);ctx.textAlign=align;ctx.fillStyle=color;
  let s=size;do{ctx.font=`bold ${s}px "${font}"`;if(ctx.measureText(text).width<=width)break;s-=2;}while(s>20);
  while(ctx.measureText(text).width>width&&text.length>1)text=text.slice(0,-2)+'…';
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
  ctx.font=`bold ${size}px "${font}"`;const words=String(text??'').split(/\s+/);let line='',rows=[];
  for(const word of words){if(line&&ctx.measureText(line+' '+word).width>width){rows.push(line);line=word;}else line+=(line?' ':'')+word;}
  if(line)rows.push(line);rows.slice(0,maxLines).forEach((row,i)=>fit(ctx,row,x,y+i*size*1.22,width,size,font,color,'left'));
}
function logo(ctx,img,label,x,y,size,font) {
  if(img){const r=Math.min(size/img.width,size/img.height);ctx.drawImage(img,x-img.width*r/2,y-img.height*r/2,img.width*r,img.height*r);}
  else {ctx.fillStyle='#132c43';ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();fit(ctx,String(label??'?').split(/\s+/).map(x=>x[0]).join('').slice(0,3),x,y+18,size*.85,48,font,'#fff');}
}
export async function renderGraphic(canvas,game,template,settings,insight=null) {
  const [w,h]=formats[settings.format]??formats['1:1'];
  const font=fonts.includes(settings.font)?settings.font:fonts[0];
  const faces=await document.fonts.load(`bold 60px "${font}"`,[game.home.name,game.away.name,game.competition,game.group,game.phase,template.heading,insight?.title,insight?.text,insight?.player,insight?.team,settings.partner,'Příliš žluťoučký kůň'].filter(Boolean).join(' '));
  if(!faces.length)throw new Error('Font se nepodařilo načíst. Obnovte stránku a zkuste export znovu.');
  await document.fonts.ready;
  const urls=[settings.background,game.home.logoUrl,game.away.logoUrl,game.organizationLogoUrl,game.groupLogoUrl,game.phaseLogoUrl,settings.partnerLogo,insight?.playerImageUrl??insight?.teamLogoUrl];
  const images=await Promise.all(urls.map((url,i)=>loadImage(url,{required:!!url&&(i===0||i===6)})));
  try {
    canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
    const story=h>w, cream='#f4efdf', ink='#0b1728', accent=settings.accent;
    const hero={x:40,y:story?170:145,w:w-80,h:story?1030:515};
    const bandY=hero.y+hero.h-20;
    c.fillStyle=settings.base;c.fillRect(0,0,w,h);
    // Poster masthead: the organization's/partner's identity, never editor branding.
    c.fillStyle=cream;c.fillRect(0,0,w,hero.y+80);
    const brandLogo=images[6]??images[3];
    if(brandLogo)logo(c,brandLogo,'',105,hero.y*.45,100,font);
    fit(c,settings.partner||game.org,brandLogo?180:55,hero.y*.45+13,brandLogo?330:440,38,font,ink,'left');
    c.fillStyle=ink;panel(c,520,20,w-540,hero.y-45,20);c.fill();
    fit(c,insight?'PLAYER SPOTLIGHT':template.id==='final'?'FINAL SCORE':'END OF PERIOD',w-65,hero.y*.45+14,460,37,font,cream,'right');
    c.save();panel(c,hero.x,hero.y,hero.w,hero.h,38);c.clip();
    if(images[0])cover(c,images[0],hero.x,hero.y,hero.w,hero.h);
    else {
      const arena=c.createLinearGradient(40,hero.y,w,hero.y+hero.h);
      arena.addColorStop(0,game.home.color||settings.base);arena.addColorStop(.5,'#152a42');arena.addColorStop(1,game.away.color||settings.base);
      c.fillStyle=arena;c.fillRect(hero.x,hero.y,hero.w,hero.h);
      c.strokeStyle='#ffffff14';c.lineWidth=3;
      for(let i=0;i<9;i++){c.beginPath();c.moveTo(-250+i*220,hero.y);c.lineTo(200+i*130,hero.y+hero.h);c.stroke();}
      const glow=c.createRadialGradient(w/2,hero.y+hero.h*.65,20,w/2,hero.y+hero.h*.65,700);
      glow.addColorStop(0,'#a7d6e529');glow.addColorStop(1,'#00000000');c.fillStyle=glow;c.fillRect(40,hero.y,hero.w,hero.h);
    }
    const shade=Number(settings.shade)||0;c.fillStyle=shade<0?`rgba(255,255,255,${-shade/100})`:`rgba(0,0,0,${shade/100})`;c.fillRect(hero.x,hero.y,hero.w,hero.h);
    const fade=c.createLinearGradient(0,hero.y,0,hero.y+hero.h);fade.addColorStop(0,'#020b1510');fade.addColorStop(1,'#020b15d9');c.fillStyle=fade;c.fillRect(hero.x,hero.y,hero.w,hero.h);
    fit(c,[game.competition,game.group].filter(Boolean).join(' / ').toUpperCase(),80,hero.y+55,800,25,font,cream,'left');
    if(images[4])logo(c,images[4],'',960,hero.y+52,65,font);
    if(insight){
      if(images[7]){const image=images[7],maxH=hero.h*.82,maxW=hero.w*.8,r=Math.min(maxW/image.width,maxH/image.height);c.drawImage(image,(w-image.width*r)/2,hero.y+hero.h-image.height*r,image.width*r,image.height*r);}
      else teamBadge(c,images[1],insight.team||insight.player,w/2,hero.y+hero.h*.52,story?310:215,font);
      fit(c,insight.type==='HATTRICK'?'HATTRICK HERO':insight.title,w/2,hero.y+hero.h-50,w-140,story?74:48,font,cream);
    }else{
      fit(c,template.id==='final'?'FINAL':template.heading,w/2,hero.y+hero.h*.31,w-150,template.id==='final'?(story?210:125):(story?90:60),font,cream);
      const y=hero.y+hero.h*.64,size=story?300:185;
      teamBadge(c,images[1],game.home.name,300,y,size,font);teamBadge(c,images[2],game.away.name,780,y,size,font);
      fit(c,'VS',w/2,y+14,110,story?45:32,font,cream);
    }
    c.restore();
    // Dense score/name block sized independently for story and square.
    c.fillStyle=accent;c.beginPath();c.moveTo(0,bandY+30);c.lineTo(w,bandY-40);c.lineTo(w,h);c.lineTo(0,h);c.fill();
    c.fillStyle=ink;c.beginPath();c.moveTo(0,bandY+65);c.lineTo(w,bandY-5);c.lineTo(w,h-60);c.lineTo(0,h-60);c.fill();
    if(insight){
      fit(c,insight.player||insight.team,65,bandY+(story?170:120),w-130,story?86:66,font,cream,'left');
      lines(c,insight.text,65,bandY+(story?255:180),w-130,story?34:28,font,'#c9d3e0',story?5:3);
    }else{
      const y=bandY+(story?290:195);
      fit(c,String(template.home),300,y,380,story?310:205,font,cream);
      fit(c,':',w/2,y-15,100,story?170:120,font,accent);
      fit(c,String(template.away),780,y,380,story?310:205,font,cream);
      fit(c,game.home.name,300,y+(story?100:70),420,story?43:32,font,cream);
      fit(c,game.away.name,780,y+(story?100:70),420,story?43:32,font,cream);
      const periods=game.timeline?.coverage==='matches-result'?game.timeline.periodScores:[];
      if(periods?.length&&template.id==='final')fit(c,periods.map(p=>`${p.home}:${p.away}`).join('   /   '),w/2,y+(story?200:115),w-140,story?34:25,font,'#a9b8cc');
    }
    fit(c,[game.playedOn,game.phase].filter(Boolean).join('  /  '),65,h-100,850,story?29:22,font,'#b4c0d0','left');
    if(images[5])logo(c,images[5],'',960,h-110,65,font);
    stripes(c,ink,0,h-30,w);fit(c,'HMS',w-40,h-18,100,21,font,ink,'right');
    const labels=['Pozadí','Logo domácích','Logo hostů','Logo organizace','Logo skupiny','Logo fáze','Logo partnera','Fotografie hráče / logo týmu'];
    return urls.flatMap((u,i)=>u&&!images[i]?[`${labels[i]} se nepodařilo načíst: použit fallback.`]:[]);
  }finally{images.forEach(i=>i?.close());}
}
