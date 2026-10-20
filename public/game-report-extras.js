import {sportingImage,flickrAlbum,youtubeVideo} from './game-report-media.js';
const {summary:s}=JSON.parse(document.getElementById('game-report-data').textContent);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const num=n=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(n);
function starCard(p){
  const article=el('article','official-star'),portrait=el('div','star-portrait');
  portrait.append(el('span','star-initials',p.name?.split(/\s+/).slice(0,2).map(v=>v[0]).join('')));
  const url=sportingImage(p.imageUrl);if(url){const img=el('img');img.src=url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';portrait.append(img);}
  const content=el('div','star-info');content.append(el('span','official-star-tag','★ HVĚZDA ZÁPASU'));
  const name=el(p.hasCard?'button':'strong','player-link',p.name);if(p.hasCard){name.type='button';name.dataset.playerId=p.id;}content.append(name);
  content.append(el('small','star-team',[s.home,s.away].find(t=>t.id.toLowerCase()===p.teamId?.toLowerCase())?.name));
  const stats=el('div','star-stats'),fields=p.role==='goalie'?[['savePercentage','ÚSPĚŠNOST %'],['saves','ZÁKROKY'],['goalsAgainst','INKASOVANÉ']]:[['goals','GÓLY'],['assists','ASISTENCE'],['points','BODY']];
  for(const [key,label] of fields)if(Number.isFinite(p[key])){const cell=el('span');cell.append(el('strong','',num(p[key])),el('small','',label));stats.append(cell);}
  content.append(stats);article.append(portrait,content);return article;
}
function applyExtras(data){
  const stars=document.getElementById('game-stars'),cards=document.getElementById('stars-cards'),rail=document.getElementById('stars-rail');
  if(Array.isArray(data.stars)&&data.stars.length&&stars&&cards){cards.replaceChildren(...data.stars.map(starCard));stars.hidden=false;
    const scroll=direction=>rail.scrollBy({left:direction*Math.max(250,rail.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    document.getElementById('stars-prev').onclick=()=>scroll(-1);document.getElementById('stars-next').onclick=()=>scroll(1);
    rail.addEventListener('keydown',e=>{if(e.target===rail&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();scroll(e.key==='ArrowLeft'?-1:1);}});
  }
  for(const node of document.querySelectorAll('[data-roster-count-team]')){
    const count=data.rosterCounts?.[node.dataset.rosterCountTeam.toLowerCase()];if(!count||!Number.isInteger(count.skaters)||!Number.isInteger(count.goalies))continue;
    node.replaceChildren(...[['HRÁČŮ V POLI',count.skaters],['BRANKÁŘŮ',count.goalies]].map(([label,value])=>{const item=el('span');item.append(el('strong','',value),el('small','',label));return item;}));node.hidden=false;
  }
  if(data.source==='hms')for(const button of document.querySelectorAll('.roster-card button[data-player-id],.spotlight-info>button[data-player-id]')){
    const rank=data.ranks?.[button.dataset.playerId.toLowerCase()];if(!Number.isInteger(rank)||rank<1||rank>10)continue;
    const badge=el('span',`roster-rank-badge ${rank===1?'rank-leader':'rank-top10'}`,rank===1?'★':'🔥');
    badge.title=rank===1?'Lídr bodování této skupiny soutěže':`#${rank} v bodování této skupiny soutěže · Top 10`;
    badge.setAttribute('aria-label',badge.title);button.append(badge);
  }
  const links=document.getElementById('report-media-links');if(links){
    const album=flickrAlbum(data.media?.albumUrl),youtube=youtubeVideo(data.media?.youtubeUrl),items=[];
    for(const [href,label,cls] of [[album,'▧ Photos here ↗','album-link']])if(href){const a=el('a',cls,label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';items.push(a);}
    if(items.length)links.replaceChildren(...items);
    const panel=document.getElementById('broadcast-panel'),player=document.getElementById('broadcast-player');
    if(youtube&&panel&&player){
      const id=new URL(youtube).searchParams.get('v'),frame=el('iframe');
      frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title='Záznam zápasu na YouTube';frame.loading='lazy';frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';player.replaceChildren(frame);
      document.getElementById('broadcast-youtube-link').href=youtube;panel.hidden=false;
      const narrow=matchMedia('(max-width:850px)'),sidebar=document.querySelector('.match-sidebar'),slot=document.getElementById('broadcast-mobile-slot');
      const place=()=>{if(narrow.matches&&slot)slot.append(panel);else sidebar.prepend(panel);};place();narrow.addEventListener('change',place);
    }
  }
}
fetch(`/api/game-summary?view=extras&gameId=${encodeURIComponent(s.gameId)}`,{headers:{accept:'application/json'}}).then(r=>r.ok?r.json():null).then(data=>{if(data)applyExtras(data);}).catch(()=>{});
