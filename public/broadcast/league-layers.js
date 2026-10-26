import {translate} from './i18n.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function standingsExcerpt(rows,homeId,awayId,{view='opponents',page=1}={}){
  const selected=view==='full'?rows.slice((page-1)*8,page*8):rows.filter(r=>same(r.id,homeId)||same(r.id,awayId));
  const result=[];for(const row of selected){const previous=result.at(-1);if(view!=='full'&&previous&&row.rank>previous.rank+1)result.push({gap:true,from:previous.rank+1,to:row.rank-1});result.push(row);}return result;
}
export function renderLeagueLayer(game,settings){
  const {layer,side='home',metric='points',lang='cs',corner='bottom-left',page=1,standingsView='opponents'}=settings,t=v=>esc(translate(v,lang));
  const league=game.league,selected=side==='away'?'away':'home',name=game[selected==='home'?'Home Team':'Away Team'];
  const full=layer==='leaders'||layer==='standings'&&standingsView==='full';
  const scope=league?.scope??{},caption=[scope.competition??game.Competition,scope.season,scope.group,scope.phase].filter(Boolean).map(esc).join(' · ');
  const team=`<div class="league-team">${game[selected+'Logo']?`<img src="${esc(game[selected+'Logo'])}" alt="${esc(name)}">`:''}<strong>${esc(name)}</strong></div>`;
  const shell=(content,footer='')=>`<main class="league-layer ${full?'league-full':'slide-panel '+esc(corner)}" data-layer="${esc(layer)}"><header><span>${caption}</span><h1>${t(layer==='standings'?'Aktuální tabulka':'TOP 5 týmu')}</h1></header>${content}${footer?`<footer>${footer}</footer>`:''}</main>`;
  const unavailable=message=>shell(`<p class="league-empty">${t(message)}</p>`);
  if(!league)return unavailable('Načítám aktuální statistiky HMS…');
  if(layer==='standings'){
    if(!league.standingsAvailable)return unavailable('Tabulka HMS nyní není dostupná.');
    const rows=standingsExcerpt(league.standings,game.homeId,game.awayId,{view:standingsView,page});
    if(!rows.length)return unavailable('Týmy nejsou v této tabulce uvedené.');
    const actual=rows.filter(r=>!r.gap),missing=standingsView==='opponents'&&actual.length<2;
    return shell(`<div class="standings-head"><span>${t('Pořadí')}</span><span>${t('Tým')}</span><span>${t('Zápasy')}</span><span>${t('Body')}</span></div><ol class="standing-rows">${rows.map(r=>r.gap?`<li class="standing-gap" aria-label="${t('Vynechaná místa')} ${r.from}–${r.to}"><span>···</span></li>`:`<li data-rank="${r.rank}" data-side="${same(r.id,game.homeId)?'home':same(r.id,game.awayId)?'away':'other'}"><b class="standing-rank">${r.rank}.</b><div class="standing-team">${r.logoUrl?`<img src="${esc(r.logoUrl)}" alt="${esc(r.name)}">`:''}<strong>${esc(r.name)}</strong></div><span class="standing-games">${r.games}</span><b class="standing-points">${r.points}</b></li>`).join('')}</ol>`,`${t('Aktuální pořadí HMS')} · ${league.standings.length} ${t('týmů')}${missing?' · '+t('Jeden z týmů není v této tabulce uvedený.'):''}${standingsView==='full'?' · '+t('Strana')+' '+page+'/'+Math.max(1,Math.ceil(league.standings.length/8)):''}`);
  }
  if(!league.leadersAvailable)return unavailable('Hráčské statistiky HMS nyní nejsou dostupné.');
  const stats=['goals','assists','points'].includes(metric)?metric:'points',metricName={points:'Body',goals:'Góly',assists:'Asistence'}[stats];
  const players=[...(league.leaders?.[selected]??[])].sort((a,b)=>b[stats]-a[stats]||b.points-a.points||b.goals-a.goals||a.games-b.games||a.name.localeCompare(b.name)).slice(0,5);
  return shell(`${team}<div class="league-metric">${t(metricName)}</div>${players.length?`<ol class="strip-players">${players.map((p,i)=>`<li><b class="strip-rank">${i+1}</b>${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}">`:'<span class="strip-photo missing-portrait" aria-hidden="true">●</span>'}<div><strong>${esc(p.name)}</strong><small>${p.games} ${t('zápasů')}</small></div><b class="strip-value">${p[stats]}</b></li>`).join('')}</ol>`:`<p class="league-empty">${t('Tým zatím nemá dostupné hráčské statistiky.')}</p>`}`,`${t('Aktuální statistiky HMS')} · ${t(league.statsScope==='group'?'Skupina':'Fáze')}`);
}
