import {sportingImage} from './game-report-media.js';
// One allowlisted portrait per known match player, shared by every report view.
export function mergeReportPortraits(summary,images={}){
  const people=[...(summary.players??[]),...(summary.goalies??[]),...(summary.timeline?.events??[]).flatMap(e=>[e.player,e.allowedBy,...(e.assists??[])].filter(Boolean))];
  const result={};
  for(const person of people){
    const id=person.id?.toLowerCase(),url=id?sportingImage(images[id]):null;
    if(url){person.imageUrl=url;result[id]=url;}
  }
  return result;
}
export function hydrateReportPortraits(root,summary,images){
  const urls=mergeReportPortraits(summary,images);
  for(const node of root.querySelectorAll('[data-player-portrait]')){
    const url=urls[node.dataset.playerPortrait?.toLowerCase()];if(!url)continue;
    const old=node.querySelector('img');if(old?.getAttribute('src')===url&&!old.hidden)continue;
    const image=document.createElement('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
    image.addEventListener('error',()=>{image.hidden=true;},{once:true});
    if(old)old.replaceWith(image);else node.append(image);
  }
}
