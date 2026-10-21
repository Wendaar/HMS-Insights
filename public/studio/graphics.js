export const formats={'1:1':[1080,1080],'9:16':[1080,1920]};
export const fonts=['Roboto','Roboto Condensed','Roboto Slab','Noto Sans','Noto Serif'];
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
    const r=await fetch(url,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(10000)});
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
function cover(ctx,img,w,h){const r=Math.max(w/img.width,h/img.height);ctx.drawImage(img,(w-img.width*r)/2,(h-img.height*r)/2,img.width*r,img.height*r);}
function logo(ctx,img,label,x,y,size,font) {
  if(img){const r=Math.min(size/img.width,size/img.height);ctx.drawImage(img,x-img.width*r/2,y-img.height*r/2,img.width*r,img.height*r);}
  else {ctx.fillStyle='#ffffff14';ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();fit(ctx,String(label??'?').split(/\s+/).map(x=>x[0]).join('').slice(0,3),x,y+18,size*.85,48,font,'#fff');}
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
    c.fillStyle=settings.base;c.fillRect(0,0,w,h);if(images[0])cover(c,images[0],w,h);
    const shade=Number(settings.shade)||0;c.fillStyle=shade<0?`rgba(255,255,255,${-shade/100})`:`rgba(0,0,0,${shade/100})`;c.fillRect(0,0,w,h);
    const gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#06152911');gradient.addColorStop(1,'#030811dd');c.fillStyle=gradient;c.fillRect(0,0,w,h);
    c.fillStyle=settings.accent;c.fillRect(65,66,8,55);
    fit(c,'HMS / MEDIA STUDIO',96,103,680,27,font,'#fff','left');
    if(images[3])logo(c,images[3],game.org,940,100,84,font);else fit(c,game.org,980,103,180,30,font,'#fff','right');
    fit(c,[game.competition,game.group].filter(Boolean).join(' · '),w/2,h*.20,w-140,30,font,'#ffffffbc');
    fit(c,insight&&settings.partner?`${settings.partner} ${insight.title}`:insight?.title??template.heading,w/2,h*.29,w-120,62,font,'#fff');
    if(insight) {
      logo(c,images[7],insight.player||insight.team,w/2,h*.46,220,font);
      fit(c,insight.player||insight.team,w/2,h*.61,w-140,50,font,'#fff');
      const words=String(insight.text??'').split(' ');let line='',lines=[];c.font=`bold 28px "${font}"`;
      for(const word of words){if(c.measureText(line+' '+word).width>w-180){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);
      lines.slice(0,4).forEach((line,i)=>fit(c,line,w/2,h*.68+i*36,w-180,28,font,'#fff'));
    }else {
      const y=h*.46;logo(c,images[1],game.home.name,280,y,190,font);logo(c,images[2],game.away.name,800,y,190,font);
      fit(c,`${template.home} : ${template.away}`,w/2,h*.65,w-120,180,font,'#fff');
      fit(c,game.home.name,280,h*.78,430,44,font,'#fff');fit(c,game.away.name,800,h*.78,430,44,font,'#fff');
    }
    c.fillStyle=settings.accent;c.fillRect(65,h-130,w-130,3);
    fit(c,[game.playedOn,game.phase].filter(Boolean).join(' · '),65,h-79,650,25,font,'#ffffffa8','left');
    if(settings.partner)fit(c,settings.partner,65,h-35,760,25,font,'#fff','left');
    if(images[6])logo(c,images[6],settings.partner,950,h-63,80,font);
    for(const [idx,x] of [[4,850],[5,930]])if(images[idx])logo(c,images[idx],'',x,h*.19,55,font);
    return urls.flatMap((u,i)=>u&&!images[i]?[`Nedostupný obrázek ${i+1}: použit grafický fallback.`]:[]);
  }finally{images.forEach(i=>i?.close());}
}
