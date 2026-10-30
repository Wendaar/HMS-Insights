import {effects,designAtmosphere,loadImage,designs} from './graphics.js';
import {fontSpec,designTypography,fonts} from './typography.js';
import {drawComparisonTeam} from '../team-comparison/graphics.js';
import {formats} from '../all-stars/presentation.js';
import {fixtureDate,invitationText} from './game-day-invitation.js';
export {formats,fonts,designs};
export const previewText=invitationText;
export const pageCapacity=format=>['16:9','16:10'].includes(format)?3:format==='1:1'?4:6;
export function storyPages(items,columns=1,capacity=6){
 if(columns===1)return Array.from({length:Math.ceil(items.length/capacity)},(_,i)=>items.slice(i*capacity,i*capacity+capacity));
 const groups=[...new Set(items.map(p=>p.venue??'—'))].map(v=>items.filter(p=>(p.venue??'—')===v)),pages=[];
 while(groups.some(g=>g.length)){const page=[];for(const group of groups.filter(g=>g.length).slice(0,2))page.push(...group.splice(0,capacity));pages.push(page);}return pages;
}
export function drawJersey(c,color,x,y,size=72){
 c.save();c.translate(x,y);c.scale(size/100,size/100);c.shadowColor='#0008';c.shadowBlur=8;
 c.beginPath();c.moveTo(28,12);c.lineTo(40,6);c.quadraticCurveTo(50,25,60,6);c.lineTo(72,12);c.lineTo(96,33);c.lineTo(81,53);c.lineTo(70,45);c.lineTo(73,91);c.quadraticCurveTo(50,98,27,91);c.lineTo(30,45);c.lineTo(19,53);c.lineTo(4,33);c.closePath();
 c.fillStyle=color||'#536779';c.fill();c.shadowBlur=0;c.strokeStyle='#b8cbde';c.lineWidth=2;c.stroke();
 c.beginPath();c.moveTo(40,6);c.quadraticCurveTo(50,25,60,6);c.strokeStyle='#0a1728';c.lineWidth=5;c.stroke();
 c.fillStyle='#15253b66';c.fillRect(28,76,44,6);c.fillRect(28,85,44,3);
 if(!color){c.fillStyle='#fff';c.font='700 34px Arial';c.textAlign='center';c.fillText('?',50,64);}c.restore();
}
export async function drawGameDay(canvas,items,settings={}){
 const {mode='day',title='',accent='#dfff3f',base='#0b1c32',background='',design='pantha',font='Hitch Grotesk',format='9:16',jerseys={},en=false,columns=1,organization=items[0]?.org??'HMS'}=settings;
 if(!/^#[a-f0-9]{6}$/i.test(accent)||!/^#[a-f0-9]{6}$/i.test(base)||Object.values(jerseys).some(v=>v&&!/^#[a-f0-9]{6}$/i.test(v)))throw Error(en?'Choose valid colors.':'Vyberte platné barvy.');
 const [w,h]=formats[format]??formats['9:16'],story=format==='9:16',r=story?{x:96,y:220,w:864,h:1360}:{x:w*.06,y:h*.06,w:w*.88,h:h*.88},k=Math.min(w/1080,h/1350),typo=designTypography(design,font);
 const strings=[items.map(p=>p.home.name+' '+p.away.name+' '+p.venue).join(' '),title||'MATCH DAY',fixtureDate(items[0]?.date,en).day];
 await Promise.all(strings.flatMap(s=>[document.fonts.load(fontSpec(typo.body,38,s)),document.fonts.load(fontSpec(typo.headline,70,s))]));await document.fonts.ready;
 const logos=new Map(),images=[];
 try{
  const bg=await loadImage(background,{required:!!background,lang:en?'en':'cs'});if(bg)images.push(bg);
  const teams=new Map(items.flatMap(p=>[p.home,p.away]).map(t=>[t.id,t]));
  await Promise.all([...teams.values()].map(async t=>{const img=await loadImage(t.logoUrl,{lang:en?'en':'cs'});if(img){logos.set(t.id,img);images.push(img);}}));
  canvas.width=w;canvas.height=h;const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,base);gradient.addColorStop(1,'#050d18');c.fillStyle=gradient;c.fillRect(0,0,w,h);
  if(bg){const z=Math.max(w/bg.width,h/bg.height);c.drawImage(bg,(w-bg.width*z)/2,(h-bg.height*z)/2,bg.width*z,bg.height*z);c.fillStyle='#06101cb8';c.fillRect(0,0,w,h);}
  effects(c,w,h,accent,design==='crazy');designAtmosphere(c,w,h,design==='artistic',design==='technical',accent);
  if(design==='pantha'){c.fillStyle=accent;c.fillRect(0,0,12*k,h);c.save();c.globalAlpha=.06;c.translate(w*.8,0);c.rotate(.35);c.fillRect(0,-h,w*.2,h*3);c.restore();}
  const text=(value,x,y,width,size=36,color='#fff',align='left',family=typo.body)=>{let s=String(value??'—'),pixels=size;c.textAlign=align;c.fillStyle=color;do{c.font=fontSpec(family,pixels,s);if(c.measureText(s).width<=width)break;pixels--;}while(pixels>16*k);if(c.measureText(s).width>width){while(s.length&&c.measureText(s+'…').width>width)s=s.slice(0,-1);s+='…';}c.fillText(s,x,y,width);};
  const plate=(x,y,pw,ph)=>{c.fillStyle='#0a192ce8';c.beginPath();c.roundRect(x,y,pw,ph,18*k);c.fill();c.strokeStyle=accent+'44';c.lineWidth=1;c.stroke();};
  const crest=(team,x,y,size)=>{const image=logos.get(team.id);if(image){const z=Math.min(size/image.width,size/image.height);c.drawImage(image,x-image.width*z/2,y-image.height*z/2,image.width*z,image.height*z);}else{c.fillStyle='#243a50';c.beginPath();c.arc(x,y,size*.48,0,Math.PI*2);c.fill();text(team.name.split(/\s+/).map(x=>x[0]).join('').slice(0,3),x,y+size*.12,size*.8,size*.32,'#fff','center');}};
  text(organization.toUpperCase()+' / HMS',r.x,r.y+24*k,r.w,23*k,accent);
  text(title||(mode==='match'?'MATCH DAY':'GAME DAY'),r.x,r.y+104*k,r.w,80*k,'#fff','left',typo.headline);
  const calendar=fixtureDate(items[0]?.date,en);
  text((calendar.day+' · '+calendar.date).toLocaleUpperCase(en?'en':'cs'),r.x,r.y+163*k,r.w,38*k,accent);
  if(mode==='match'&&items[0]){
   const p=items[0],metadataY=r.y+195*k,metadataH=145*k,timeW=r.w*.29;
   plate(r.x,metadataY,r.w,metadataH);text(en?'FACE-OFF':'ZAČÁTEK',r.x+24*k,metadataY+34*k,timeW-30*k,20*k,'#b4c8da');text(p.time??'—',r.x+24*k,metadataY+110*k,timeW-30*k,79*k,accent);
   text(en?'VENUE':'STADION',r.x+timeW+22*k,metadataY+34*k,r.w-timeW-45*k,20*k,'#b4c8da');text(p.venue??(en?'To be confirmed':'Bude upřesněno'),r.x+timeW+22*k,metadataY+105*k,r.w-timeW-45*k,57*k);
   text(p.competition??'',r.x,r.y+378*k,r.w,27*k,'#b4c8da');
   const y=r.y+405*k,cardH=r.h-405*k-105*k,gap=22*k,cardW=(r.w-gap)/2;
   for(const [i,side]of ['home','away'].entries()){
    const team=p[side],x=r.x+i*(cardW+gap),t={...team,...team.preview,form:team.preview?.form??[]};
    drawComparisonTeam(c,t,{x,y,width:cardW,height:cardH,logo:logos.get(team.id),typo,en});
    drawJersey(c,jerseys[side]||team.jerseyColor,x+cardW-72*k,y+18*k,56*k);
    const form=t.form.map(g=>g.result).join(' · ')||'—',rating=t.rating?.score??'—';
    text(form,x+cardW/2,y+cardH+36*k,cardW-15*k,25*k,accent,'center');text((en?'Rating ':'Rating ')+rating+' / 100',x+cardW/2,y+cardH+70*k,cardW-15*k,23*k,'#d1dfeb','center');
   }
  }else{
   const groups=columns===2?[...new Set(items.map(p=>p.venue??'—'))]:[''],count=Math.min(2,groups.length||1),gap=22*k,colW=(r.w-gap*(count-1))/count,top=r.y+220*k,available=r.h-260*k;
   groups.slice(0,2).forEach((group,index)=>{
    const rows=items.filter(p=>!group||(p.venue??'—')===group),x=r.x+index*(colW+gap),groupH=group?52*k:0,maxRows=Math.max(1,...groups.slice(0,2).map(g=>items.filter(p=>!g||(p.venue??'—')===g).length)),rowH=Math.min((available-groupH)/maxRows,235*k);
    if(group)text(group,x,top+25*k,colW,31*k,accent);
    rows.forEach((p,i)=>{const y=top+groupH+i*rowH,ph=rowH-14*k;plate(x,y,colW,ph);text(p.time??'—',x+18*k,y+43*k,colW*.37,41*k,accent);text(group?p.competition:(p.venue??'—'),x+colW*.40,y+39*k,colW*.56,25*k,'#d1dfeb');
     const size=Math.min(ph*.28,56*k),a=y+ph*.53,b=y+ph*.82,left=x+28*k+size/2;crest(p.home,left,a,size);crest(p.away,left,b,size);text(p.home.name,left+size*.8,a+10*k,colW-size*1.7-35*k,Math.min(33*k,ph*.19));text(p.away.name,left+size*.8,b+10*k,colW-size*1.7-35*k,Math.min(33*k,ph*.19));});
   });
  }
  text('HMS · HERO MANAGEMENT SYSTEM',r.x,r.y+r.h+26*k,r.w,18*k,'#a8c0d5');
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 }finally{for(const image of images)image.close();}
}
