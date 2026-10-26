import {translate} from './i18n.js';
import {extraNames,renderExtraLayer} from './extra-layers.js';
export const layers=['opening','periods','lineup','scoresheet','insights',...Object.keys(extraNames)];
export const layerNames={opening:'Před zápasem',periods:'Stav po třetinách',lineup:'Soupiska',scoresheet:'Přehled gólů',insights:'Malé insights',...extraNames};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderMatchLayer(game,settings){
  const {layer,side='home',period='current',page=1,insight='',lang='cs'}=settings;
  if(extraNames[layer])return renderExtraLayer(game,settings);
  const t=v=>esc(translate(v,lang)),m=game.match,team=s=>esc(game[s==='home'?'Home Team':'Away Team']);
  const heading=layerNames[layer],title=`<header><span>${esc(game.Competition||'HMS')} · ${esc(game.Date)}</span><h1>${t(heading)}</h1><p>${team('home')} — ${team('away')}</p></header>`;
  const empty=message=>`<div class="layer-empty">${t(message)}</div>`;
  const rowTeam=s=>`<div class="match-team">${game[s+'Logo']?`<img src="${esc(game[s+'Logo'])}" alt="">`:''}<strong>${team(s)}</strong></div>`;
  const shell=content=>`<main class="match-layer ${layer==='insights'?'compact-layer':''}" data-layer="${esc(layer)}">${title}${content}<footer>${t(layer==='lineup'?'Zápasová soupiska z HMS':'Podle zapsaných gólových událostí · bez živé časomíry')}</footer></main>`;
  if(!m)return shell(empty('Čekáme na data v HMS'));
  if(layer==='lineup'){
    if(m.lineupAvailable===false)return shell(empty('Čekáme na data v HMS'));
    const selected=side==='both'?['home','away']:[side],size=side==='both'?12:20;
    return shell(`<div class="lineup-columns ${selected.length===1?'single-team':''}">${selected.map(s=>{
      const all=m.roster.filter(p=>p.side===s),rows=all.slice((page-1)*size,page*size);
      return `<section>${rowTeam(s)}${rows.length?`<ol class="roster-list">${rows.map(p=>`<li><b>${esc(p.number??'—')}</b>${p.imageUrl?`<img class="roster-portrait" src="${esc(p.imageUrl)}" alt="${esc(p.name)}">`:'<i class="roster-portrait missing-portrait" aria-hidden="true">●</i>'}<span>${esc(p.name)}</span>${p.goalie?`<small>${t('Brankář')}</small>`:''}</li>`).join('')}</ol><p class="page-label">${t('Strana')} ${page} / ${Math.ceil(all.length/size)}</p>`:empty(all.length?'Na této stránce nejsou další hráči.':'Soupiska ještě není v HMS vyplněná.')}</section>`;
    }).join('')}</div>`);
  }
  if(layer==='periods'){
    if(game.status==='NOT PLAYED')return shell(empty('Před začátkem zápasu'));
    let score=m.score,selected=Number(period),caption=game.status==='FINISHED'?'Konečný výsledek':'Zapsaný stav v HMS';
    if(period!=='current'){
      if(!m.periods.length)return shell(empty(m.coverage==='matches-score'?'Třetiny nejsou v HMS kompletně přiřazené.':'Neúplné gólové události v HMS'));
      score={home:0,away:0};for(const p of m.periods.filter(p=>p.period<=selected)){score.home+=p.home;score.away+=p.away;}
      caption=`Po ${selected}. třetině`;
    }
    return shell(`<p class="score-caption">${t(caption)}</p><div class="period-score">${rowTeam('home')}<strong>${esc(score.home??'—')} : ${esc(score.away??'—')}</strong>${rowTeam('away')}</div>
      ${m.periods.length?`<div class="period-breakdown">${m.periods.map(p=>`<span>${p.period}. <b>${p.home}:${p.away}</b></span>`).join('')}</div>`:''}
      ${m.coverage!=='matches-score'?`<p>${t('Výsledek je upravený nebo události nejsou úplné.')}</p>`:''}`);
  }
  if(layer==='scoresheet'){
    if(m.coverage!=='matches-score')return shell(empty('Neúplné gólové události v HMS'));
    const goals=m.goals.filter(g=>side==='both'||g.side===side),rows=goals.slice((page-1)*8,page*8);
    return shell(rows.length?`<p class="score-caption">${t('Čas dle HMS')}</p><ol class="goal-list">${rows.map(g=>`<li data-side="${esc(g.side)}"><b>${esc(g.clock??'—')}<small>${g.period===null?'—':g.period+'.'}</small></b><span class="goal-team-logo">${game[g.side+'Logo']?`<img src="${esc(game[g.side+'Logo'])}" alt="${team(g.side)}">`:`<strong>${team(g.side)}</strong>`}</span>${g.scorer.imageUrl?`<img class="goal-portrait" src="${esc(g.scorer.imageUrl)}" alt="">`:''}<div><strong>${esc(g.scorer.name||translate('Střelec neuveden',lang))}</strong><small class="goal-team-name">${team(g.side)}</small><small>${g.assists.length?t('Asistence')+': '+g.assists.map(p=>esc(p.name||'—')).join(', '):''}</small></div><em>${g.scoreAfter?`${g.scoreAfter.home}:${g.scoreAfter.away}`:'—'}</em></li>`).join('')}</ol><p class="page-label">${t('Strana')} ${page} / ${Math.ceil(goals.length/8)}</p>`:empty('Zatím žádný zapsaný gól'));
  }
  if(layer==='insights'){
    const item=insight?m.insights.find(i=>i.id===insight):m.insights[0];
    if(!item)return shell(empty(m.coverage==='matches-score'?'Zatím žádný hattrick ani vícebodový výkon':'Neúplné gólové události v HMS'));
    const photo=item.imageUrl??m.roster?.find(p=>p.id===item.id&&p.side===item.side)?.imageUrl;
    return shell(`<article class="insight-card"><div class="insight-title">${t(item.type==='hat-trick'?'Hattrick':'Vícebodový zápas')}</div><div class="insight-person">${photo?`<img class="insight-portrait" src="${esc(photo)}" alt="${esc(item.name)}">`:'<span class="insight-portrait missing-portrait" aria-hidden="true">●</span>'}<div><h2>${esc(item.name)}</h2>${rowTeam(item.side)}</div></div><div class="insight-stats">${[['Góly',item.goals],['Asistence',item.assists],['Body',item.points]].map(([label,value])=>`<span><b>${value}</b>${t(label)}</span>`).join('')}</div></article>`);
  }
  return shell(empty('Čekáme na data v HMS'));
}
