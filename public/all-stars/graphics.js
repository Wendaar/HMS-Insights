import {fontSpec,fontForText,designTypography} from '../studio/typography.js';
import {designs,loadImage,effects,designAtmosphere} from '../studio/graphics.js';
import {sportingImage} from '../game-report-media.js';
import {formats,graphicSettings} from './presentation.js';
export {designs};
const media=new Map();
async function picture(url,local=false){
  if(!url)return null;
  if(!media.has(url)){
    if(media.size>=100)media.delete(media.keys().next().value);
    media.set(url,local?fetch(url).then(r=>{if(!r.ok)throw Error();return r.blob();}).then(createImageBitmap).catch(()=>null):loadImage(url));
  }
  return media.get(url);
}
function text(c,value,x,y,width,size,font,color='#ffffff',align='center'){
  const label=String(value??'').normalize('NFC');let pixels=size;c.textAlign=align;c.fillStyle=color;
  while(pixels>12){c.font=fontSpec(font,pixels,label);if(c.measureText(label).width<=width)break;pixels-=1;}
  c.fillText(label,x,y,width);
}
function cover(c,image,x,y,w,h){const scale=Math.max(w/image.width,h/image.height);c.drawImage(image,x+(w-image.width*scale)/2,y+(h-image.height*scale)/2,image.width*scale,image.height*scale);}
function contain(c,image,x,y,w,h){const scale=Math.min(w/image.width,h/image.height);c.drawImage(image,x+(w-image.width*scale)/2,y+(h-image.height*scale)/2,image.width*scale,image.height*scale);}
const roleLabels={cs:{F:'ÚTOČNÍK',D:'OBRÁNCE',G:'BRANKÁŘ'},en:{F:'FORWARD',D:'DEFENDER',G:'GOALIE'}};
export async function renderAllStarsGraphic(canvas,lineup,context,preferences){
  const settings=graphicSettings(preferences,context.org),[w,h]=formats[settings.format],portrait=h>w,square=w===h,lang=context.lang==='en'?'en':'cs';
  const typography=designTypography(settings.design,settings.font),labelFont=settings.design==='pantha'?'Frontline':typography.body;
  const labels=roleLabels[lang],c=canvas.getContext('2d'),accent=settings.design==='artistic'?'#f0ca77':settings.design==='pantha'?'#dfff3f':'#8de1c9';
  const players=['F','D','G'].flatMap(role=>lineup[role]??[]),missing=[];
  // Load the exact families used in the graphic; the Studio's glyph-aware font
  // selection preserves Czech names instead of silently dropping diacritics.
  const fontLoads=[[typography.headline,'ALL STARS'],[labelFont,Object.values(labels).join(' ')+' HALL OF FAME HMS HVĚZDY MĚSÍCE'],[typography.body,players.map(p=>p.name+' '+p.team).join(' ')+' Vyberte hráče Choose a player '+(context.group??'')]];
  await Promise.all(fontLoads.map(([family,value])=>document.fonts.load(fontSpec(fontForText(family,value),32,value),value)));
  await document.fonts.ready;
  const bgPath=context.org?.toLowerCase()==='phm'&&settings.design==='pantha'?'/all-stars/assets/'+(portrait?'portrait':'landscape')+'.webp':null;
  const groupImage=sportingImage(context.groupLogoUrl);
  const [background,groupLogo,images]=await Promise.all([picture(bgPath,true),picture(groupImage),Promise.all(players.map(async p=>({id:p.id,photo:await picture(sportingImage(p.imageUrl)),logo:await picture(sportingImage(p.teamLogoUrl))})))]);
  canvas.width=w;canvas.height=h;c.fillStyle='#081420';c.fillRect(0,0,w,h);
  if(background)cover(c,background,0,0,w,h);
  if(bgPath&&!background)missing.push(lang==='en'?'PHM background':'PHM pozadí');
  if(!background){const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#243e58');g.addColorStop(1,'#07111e');c.fillStyle=g;c.fillRect(0,0,w,h);}
  effects(c,w,h,accent,settings.design==='crazy');designAtmosphere(c,w,h,settings.design==='artistic',settings.design==='technical',accent);
  const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#02091230');shade.addColorStop(1,'#020912b0');c.fillStyle=shade;c.fillRect(0,0,w,h);
  const margin=w*.055,head=h*(portrait?.15:.19),safeTop=settings.format==='9:16'?120:0,safeBottom=settings.format==='9:16'?150:0;
  text(c,`${String(context.org??'HMS').toUpperCase()} / HALL OF FAME`,margin,margin*.7+safeTop,w*.6,Math.min(25,w*.022),labelFont,accent,'left');
  text(c,'ALL STARS',margin,head+safeTop,w*.88,portrait?112:square?105:122,typography.headline,'#fff','left');
  let month=context.month??'';if(/^\d{4}-\d{2}$/.test(month))month=new Date(month+'-15T12:00:00Z').toLocaleDateString(lang==='cs'?'cs-CZ':'en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  const subtitle=[context.group,month].filter(Boolean).join(' · '),sy=head+safeTop+(portrait?56:48);
  if(groupLogo)contain(c,groupLogo,margin,sy-32,45,45);
  text(c,subtitle,margin+(groupLogo?60:0),sy,w*.88-(groupLogo?60:0),portrait?30:32,settings.font,'#ccdfeb','left');
  const top=sy+(portrait?75:52),bottom=h-safeBottom-75,area=bottom-top;
  const slots=[];
  if(settings.template==='rink')for(const [ri,role]of ['F','D','G'].entries()){
    const count={F:3,D:2,G:1}[role],cellW=w*(portrait?.29:.255),cellH=area/3;
    for(let i=0;i<count;i++)slots.push({role,p:lineup[role]?.[i],x:w/2+(i-(count-1)/2)*cellW,y:top+cellH*ri,cw:cellW,ch:cellH});
  }else{
    const columns=portrait?2:3,rows=6/columns,gap=w*.018,cw=(w-2*margin-gap*(columns-1))/columns,ch=(area-gap*(rows-1))/rows;
    ['F','F','F','D','D','G'].forEach((role,i)=>{const offset=role==='F'?i:role==='D'?i-3:0;slots.push({role,p:lineup[role]?.[offset],x:margin+(i%columns)*(cw+gap)+cw/2,y:top+Math.floor(i/columns)*(ch+gap),cw,ch,card:true});});
  }
  for(const {p,role,x,y,cw,ch,card}of slots){
    if(card){c.fillStyle='#0b1c2ddd';c.strokeStyle=accent+'80';c.lineWidth=1.5;c.beginPath();c.roundRect(x-cw/2,y,cw,ch,18);c.fill();c.stroke();}
    const radius=Math.min(cw*.22,ch*.25),cy=y+radius+(card?18:4),asset=images.find(i=>i.id===p?.id);
    c.save();c.beginPath();c.arc(x,cy,radius,0,Math.PI*2);c.clip();c.fillStyle='#19364a';c.fillRect(x-radius,cy-radius,radius*2,radius*2);
    if(asset?.photo)cover(c,asset.photo,x-radius,cy-radius,radius*2,radius*2);else text(c,p?p.name.split(/\s+/).filter(Boolean).map(n=>n[0]).slice(0,2).join(''):'+',x,cy+radius*.28,radius*1.6,radius*.75,settings.font,'#9bdcf3');
    c.restore();c.strokeStyle=accent;c.lineWidth=2;c.beginPath();c.arc(x,cy,radius,0,Math.PI*2);c.stroke();
    if(p?.imageUrl&&!asset?.photo)missing.push(p.name);
    const ny=cy+radius+Math.min(36,ch*.13),name=p?.name??(lang==='en'?'Choose a player':'Vyberte hráče');
    text(c,name,x,ny,cw*.91,Math.min(34,cw*.095),settings.font);
    const teamY=ny+Math.min(34,ch*.13),team=p?.team??'—';
    if(asset?.logo){const size=Math.min(29,ch*.12);contain(c,asset.logo,x-cw*.4,teamY-size*.85,size,size);}
    if(p?.teamLogoUrl&&!asset?.logo)missing.push(`${lang==='en'?'Team logo':'Logo týmu'} · ${team}`);
    text(c,team,x+(asset?.logo?12:0),teamY,cw*(asset?.logo?.75:.88),Math.min(24,cw*.065),settings.font,'#c2d4e4');
    text(c,labels[role],x,teamY+Math.min(30,ch*.12),cw*.9,Math.min(21,cw*.055),labelFont,accent);
  }
  c.strokeStyle='#ffffff40';c.beginPath();c.moveTo(margin,h-safeBottom-51);c.lineTo(w-margin,h-safeBottom-51);c.stroke();
  const selected=players.length,footer=selected===6?(lang==='en'?'STARS OF THE MONTH':'HVĚZDY MĚSÍCE'):`${lang==='en'?'DRAFT':'PRACOVNÍ NÁHLED'} · ${selected} / 6`;
  text(c,footer,margin,h-safeBottom-23,w*.7,19,labelFont,'#a9c3d4','left');text(c,'HMS',w-margin,h-safeBottom-23,w*.15,19,labelFont,'#a9c3d4','right');
  if(groupImage&&!groupLogo)missing.push(lang==='en'?'Division logo':'Logo divize');
  return {width:w,height:h,missing:[...new Set(missing)],settings};
}
