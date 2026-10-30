import {safeArea} from './graphics.js';
export function storyPages(items,columns=1){
 if(columns===1)return Array.from({length:Math.ceil(items.length/6)},(_,i)=>items.slice(i*6,i*6+6));
 const groups=[...new Set(items.map(p=>p.venue??'—'))].map(v=>items.filter(p=>(p.venue??'—')===v)),pages=[];
 while(groups.some(g=>g.length)){const page=[];for(const group of groups.filter(g=>g.length).slice(0,2))page.push(...group.splice(0,6));pages.push(page);}return pages;
}
export function previewText(p,{en=false,title='',jerseys={}}={}) {
 const no=en?'Unavailable':'Nedostupné',lines=[title||'GAME DAY',`${p.home.name} × ${p.away.name}`,`${p.date} · ${p.time??no}`,`${p.competition??''} · ${p.venue??no}`];
 for(const key of ['home','away']){const t=p[key],s=t.preview;lines.push(`${t.name} · ${en?'Jersey':'Dres'}: ${jerseys[key]||t.jerseyColor||no}`);if(s)lines.push(`${en?'Rank':'Pořadí'} ${s.rank??no} · ${en?'Form':'Forma'} ${s.form.map(x=>x.result).join(' ')||no} · ${en?'Attack / defense':'Útok / obrana'} ${s.offense?.toFixed(2)??no} / ${s.defense?.toFixed(2)??no}`,`${en?'Rating':'Rating'} ${s.rating?.score??no} / 100 · ${en?'Attendance':'Účast'} ${s.attendance?.toFixed(1)??no}`,s.players.map(x=>`${x.name}: ${x.points??'—'}`).join(' · '));}
 lines.push(new URL(p.links.game,location.origin).href,new URL(p.links.compare,location.origin).href);return lines.join('\n');
}
export async function drawGameDay(canvas,items,{mode='day',title='',accent='#78e5b8',jerseys={},en=false,columns=1}={}){
 if(!/^#[a-f0-9]{6}$/i.test(accent)||Object.values(jerseys).some(v=>v&&!/^#[a-f0-9]{6}$/i.test(v)))throw Error(en?'Use jersey colors as #rrggbb.':'Barvu dresu zadejte jako #rrggbb.');
 await document.fonts.load('700 38px "Barlow Condensed"');
 canvas.width=1080;canvas.height=1920;const c=canvas.getContext('2d'),r=safeArea('9:16');c.fillStyle='#0b1c32';c.fillRect(0,0,1080,1920);
 const text=(value,x,y,width,size=36,color='#ffffff')=>{c.fillStyle=color;c.font=`700 ${size}px "Barlow Condensed",sans-serif`;let s=String(value);while(c.measureText(s).width>width&&s.length>1)s=s.slice(0,-2)+'…';c.fillText(s,x,y);};
 c.fillStyle=accent;c.fillRect(r.x,r.y,r.w,8);text(title||'GAME DAY',r.x,r.y+100,r.w,76,accent);text(items[0]?.date??'',r.x,r.y+155,r.w,36);
 const logos=new Map();await Promise.all(items.flatMap(p=>[p.home,p.away]).filter(t=>t.logoUrl).map(async t=>{try{const image=new Image();image.src='/api/studio-image?'+new URLSearchParams({url:t.logoUrl});await image.decode();logos.set(t.id,image);}catch{}}));
 if(mode==='match'&&items[0]){
  const p=items[0];let y=r.y+220;
  for(const key of ['home','away']){const t=p[key],img=logos.get(t.id);if(img){const scale=Math.min(180/img.width,180/img.height);c.drawImage(img,r.x,y,img.width*scale,img.height*scale);}text(t.name,r.x+210,y+80,r.w-210,48);const color=jerseys[key]||t.jerseyColor;
   text(`${en?'Jersey':'Dres'}: ${color??'—'}`,r.x+210,y+145,r.w-210,32);if(color){c.fillStyle=color;c.fillRect(r.x+160,y+155,30,30);}y+=230;}
  const lines=previewText(p,{en,title,jerseys}).split('\n').slice(2).filter(x=>!x.startsWith('http'));
  for(const line of lines){if(y>r.y+r.h-45)break;text(line,r.x,y,r.w,30);y+=54;}
 }else{
  const groups=columns===2?[...new Set(items.map(p=>p.venue??'—'))]:[''];const colWidth=r.w/Math.min(2,groups.length||1);
  groups.slice(0,2).forEach((group,index)=>{let y=r.y+245;const x=r.x+index*colWidth,w=colWidth-24;if(group){text(group,x,y,w,34,accent);y+=65;}
   for(const p of items.filter(p=>!group||(p.venue??'—')===group)){text(`${p.time??'—'} · ${p.competition??''}`,x,y,w,27,accent);text(p.home.name,x,y+48,w,38);text('× '+p.away.name,x,y+95,w,38);if(!group)text(p.venue??'—',x,y+139,w,27);y+=180;}
  });
 }
 text('HMS · HERO MANAGEMENT SYSTEM',r.x,r.y+r.h,r.w,24,accent);
 return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}
