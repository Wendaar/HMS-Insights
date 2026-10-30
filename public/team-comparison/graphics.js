import {resultColors} from './ui.js';
import {fontSpec,designTypography} from '../studio/typography.js';
import {effects,designAtmosphere,loadImage} from '../studio/graphics.js';
import {formats} from '../all-stars/presentation.js';
const text=(c,s,x,y,w,size,font,color='#fff',align='center')=>{s=String(s??'—');c.textAlign=align;c.fillStyle=color;while(size>12){c.font=fontSpec(font,size,s);if(c.measureText(s).width<=w)break;size--;}c.fillText(s,x,y,w);};
function badges(c,values,x,y,size,font){
 const gap=8,padding=12,height=size*1.15,widths=values.map(v=>{c.font=fontSpec(font,size,v.label);return c.measureText(v.label).width+padding*2;}),total=widths.reduce((a,b)=>a+b,0)+gap*(values.length-1);let left=x-total/2;
 values.forEach((v,i)=>{c.fillStyle=resultColors[v.result];c.beginPath();c.roundRect(left,y-height*.8,widths[i],height,5);c.fill();text(c,v.label,left+widths[i]/2,y,widths[i]-8,size,font);left+=widths[i]+gap;});
}
export async function renderComparison(canvas,teams,context,settings){
 const [w,h]=formats[settings.format],portrait=h>w,typo=designTypography(settings.design,settings.font),en=context.lang==='en',accent=settings.design==='pantha'?'#dfff3f':'#99e2cb';
 await Promise.all([document.fonts.load(fontSpec(typo.headline,32,'TEAM COMPARISON')),document.fonts.load(fontSpec(typo.body,32,teams.map(t=>t.name).join(' ')))]);await document.fonts.ready;
 const logos=await Promise.all(teams.map(t=>loadImage(t.logoUrl).catch(()=>null)));
 canvas.width=w;canvas.height=h;const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#304a63');gradient.addColorStop(1,'#07111e');c.fillStyle=gradient;c.fillRect(0,0,w,h);effects(c,w,h,accent,settings.design==='crazy');designAtmosphere(c,w,h,settings.design==='artistic',settings.design==='technical',accent);
 const pad=w*.06,top=h*(portrait?.11:.16);text(c,context.org.toUpperCase()+' / HMS',pad,h*.055,w*.9,Math.min(w*.025,26),typo.body,accent,'left');text(c,'TEAM COMPARISON',pad,top,w*.88,Math.min(w*.07,90),typo.headline,'#fff','left');
 text(c,context.subtitle,pad,top+h*.05,w*.88,Math.min(w*.025,32),typo.body,'#c7d8e7','left');
 const y0=top+h*.1,bottom=h*.91,cardW=(w-pad*2-w*.025)/2;
 for(let i=0;i<teams.length;i++){
  drawComparisonTeam(c,teams[i],{x:pad+i*(cardW+w*.025),y:y0,width:cardW,height:bottom-y0,logo:logos[i],typo,en,template:settings.template});
  logos[i]?.close();
 }
 text(c,en?'HMS · Selected phase · '+context.readAt.slice(0,10):'HMS · Vybraná fáze · '+context.readAt.slice(0,10),pad,h*.96,w*.88,Math.min(w*.02,23),typo.body,'#b8cfe1','left');
 return teams.filter((t,i)=>t.logoUrl&&!logos[i]).map(t=>t.name);
}

// Shared Team Compare card, also used by Game Day invitations. Sporting metrics
// come from the same Team Compare service; callers own loaded image lifetimes.
export function drawComparisonTeam(c,t,{x,y,width,height,logo=null,typo,en=false,template='summary'}){
 const w=c.canvas.width,cardW=width,cx=x+cardW/2,y0=y,area=height;
  c.fillStyle='#0c1c2bdb';c.beginPath();c.roundRect(x,y0,cardW,area,20);c.fill();
  const size=Math.min(cardW*.26,area*.18),iy=y0+area*.06;if(logo){const s=Math.min(size/logo.width,size/logo.height);c.drawImage(logo,cx-logo.width*s/2,iy,logo.width*s,logo.height*s);}else{c.fillStyle='#253f57';c.beginPath();c.arc(cx,iy+size/2,size/2,0,Math.PI*2);c.fill();text(c,t.name.split(/\s+/).map(s=>s[0]).join('').slice(0,3),cx,iy+size*.65,size*.8,size*.32,typo.body);}
  text(c,t.name,cx,iy+size+area*.08,cardW*.88,Math.min(w*.035,46),typo.body);
  const rows=template==='form'?[[en?'Last results':'Poslední výsledky',t.form.map(g=>g.result).join(' · ')||'—','form'],[en?'Wins / draws / losses':'Výhry / remízy / prohry',`${t.wins??'—'} / ${t.draws??'—'} / ${t.losses??'—'}`,'record'],[en?'Games':'Zápasy',t.games]]:[[en?'Official rank':'Oficiální pořadí',t.rank],[en?'Points · Games':'Body · Zápasy',`${t.points??'—'} · ${t.games??'—'}`],[en?'Score':'Skóre',t.score,'score'],[en?'Goals for / game':'Vstřelené góly / zápas',t.offense?.toFixed(2)??'—'],[en?'Goals against / game':'Inkasované góly / zápas',t.defense?.toFixed(2)??'—']];
  rows.forEach(([k,v,type],j)=>{const y=y0+area*.43+j*area*.105,baseline=y+area*.065,pixels=Math.min(w*.033,43,area*.058);text(c,k,cx,y,cardW*.87,Math.min(w*.02,27,area*.035),typo.body,'#a6c4d8');
   if(type==='form'&&t.form.length)badges(c,t.form.map(g=>({label:g.result,result:g.result})),cx,baseline,pixels,typo.body);
   else if(type==='record')badges(c,[['W',t.wins],['D',t.draws],['L',t.losses]].map(([result,value])=>({label:String(value??'—'),result})),cx,baseline,pixels,typo.body);
   else if(type==='score'&&Number.isFinite(t.goalsFor)&&Number.isFinite(t.goalsAgainst)){
    const d=t.goalsFor-t.goalsAgainst,suffix=` (${d>0?'+':''}${d})`;c.font=fontSpec(typo.body,pixels,String(v));const a=c.measureText(String(v)).width;c.font=fontSpec(typo.body,pixels*.8,suffix);const b=c.measureText(suffix).width,left=cx-(a+b)/2;text(c,v,left,baseline,a+2,pixels,typo.body,'#fff','left');text(c,suffix,left+a,baseline,b+2,pixels*.8,typo.body,d>0?resultColors.goal:d<0?resultColors.L:'#b6cad9','left');
   }else text(c,v,cx,baseline,cardW*.87,pixels,typo.body);
  });
}
