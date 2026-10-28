import {fontSpec,designTypography} from '../studio/typography.js';
import {effects,designAtmosphere,loadImage} from '../studio/graphics.js';
import {formats} from '../all-stars/presentation.js';
const text=(c,s,x,y,w,size,font,color='#fff',align='center')=>{s=String(s??'—');c.textAlign=align;c.fillStyle=color;while(size>12){c.font=fontSpec(font,size,s);if(c.measureText(s).width<=w)break;size--;}c.fillText(s,x,y,w);};
export async function renderComparison(canvas,teams,context,settings){
 const [w,h]=formats[settings.format],portrait=h>w,typo=designTypography(settings.design,settings.font),en=context.lang==='en',accent=settings.design==='pantha'?'#dfff3f':'#99e2cb';
 await Promise.all([document.fonts.load(fontSpec(typo.headline,32,'TEAM COMPARISON')),document.fonts.load(fontSpec(typo.body,32,teams.map(t=>t.name).join(' ')))]);await document.fonts.ready;
 const logos=await Promise.all(teams.map(t=>loadImage(t.logoUrl).catch(()=>null)));
 canvas.width=w;canvas.height=h;const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#304a63');gradient.addColorStop(1,'#07111e');c.fillStyle=gradient;c.fillRect(0,0,w,h);effects(c,w,h,accent,settings.design==='crazy');designAtmosphere(c,w,h,settings.design==='artistic',settings.design==='technical',accent);
 const pad=w*.06,top=h*(portrait?.11:.12);text(c,context.org.toUpperCase()+' / HMS',pad,top*.5,w*.9,Math.min(w*.025,26),typo.body,accent,'left');text(c,'TEAM COMPARISON',pad,top,w*.88,Math.min(w*.07,90),typo.headline,'#fff','left');
 text(c,context.subtitle,pad,top+h*.05,w*.88,Math.min(w*.025,32),typo.body,'#c7d8e7','left');
 const y0=top+h*.1,bottom=h*.91,cardW=(w-pad*2-w*.025)/2;
 for(let i=0;i<teams.length;i++){
  const t=teams[i],x=pad+i*(cardW+w*.025),cx=x+cardW/2,area=bottom-y0;
  c.fillStyle='#0c1c2bdb';c.beginPath();c.roundRect(x,y0,cardW,area,20);c.fill();
  const size=Math.min(cardW*.26,area*.18),iy=y0+area*.06,logo=logos[i];if(logo){const s=Math.min(size/logo.width,size/logo.height);c.drawImage(logo,cx-logo.width*s/2,iy,logo.width*s,logo.height*s);}
  if(logo)logo.close();
  text(c,t.name,cx,iy+size+area*.08,cardW*.88,Math.min(w*.035,46),typo.body);
  const rows=settings.template==='form'?[[en?'Last results':'Poslední výsledky',t.form.map(g=>g.result).join(' · ')||'—'],[en?'Wins / draws / losses':'Výhry / remízy / prohry',`${t.wins??'—'} / ${t.draws??'—'} / ${t.losses??'—'}`],[en?'Games':'Zápasy',t.games]]:[[en?'Official rank':'Oficiální pořadí',t.rank],[en?'Points · Games':'Body · Zápasy',`${t.points} · ${t.games}`],[en?'Score':'Skóre',t.score],[en?'Goals for / game':'Vstřelené góly / zápas',t.offense?.toFixed(2)??'—'],[en?'Goals against / game':'Inkasované góly / zápas',t.defense?.toFixed(2)??'—']];
  rows.forEach(([k,v],j)=>{const y=y0+area*.43+j*area*.105;text(c,k,cx,y,cardW*.87,Math.min(w*.02,27),typo.body,'#a6c4d8');text(c,v,cx,y+area*.055,cardW*.87,Math.min(w*.033,43),typo.body);});
 }
 text(c,en?'HMS · Selected phase · '+context.readAt.slice(0,10):'HMS · Vybraná fáze · '+context.readAt.slice(0,10),pad,h*.96,w*.88,Math.min(w*.02,23),typo.body,'#b8cfe1','left');
 return teams.filter((t,i)=>t.logoUrl&&!logos[i]).map(t=>t.name);
}
