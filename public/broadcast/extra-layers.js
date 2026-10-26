import {translate} from './i18n.js';
import {teamPartners} from './partner-playlist.js';
import {renderLeagueLayer} from './league-layers.js';
export const extraNames={cta:'QR výzva',sponsors:'Partner v rohu',announcement:'Velké partnerské oznámení',powerplay:'Přesilovka / oslabení',leaders:'Lídři týmu','leaders-strip':'TOP 5 týmu · sloupec',standings:'Aktuální tabulka',next:'Příští zápasy',results:'Poslední výsledky'};
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function eligibleAssets(items,{org,gameId,homeId,awayId,side='home',kind}){
  const eq=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();
  const teamIds=side==='both'?[homeId,awayId]:[side==='away'?awayId:homeId];
  return (items??[]).filter(a=>a.enabled&&a.kind===kind&&a.org===org&&(a.scope==='organization'||a.scope==='game'&&eq(a.targetId,gameId)||a.scope==='team'&&teamIds.some(id=>id&&eq(id,a.targetId))));
}
export function renderExtraLayer(game,settings){
  if(['leaders-strip','standings'].includes(settings.layer)||settings.layer==='leaders'&&game.league)return renderLeagueLayer(game,settings);
  const {layer,lang='cs',side:rawSide='home',metric='goals',corner='bottom-left',assetId='',org='PHM',items=[],rotationIndex=0}=settings;
  const side=rawSide==='away'?'away':'home',opponent=side==='home'?'away':'home',t=v=>esc(translate(v,lang));
  const team=s=>`<div class="extra-team">${game[s+'Logo']?`<img src="${esc(game[s+'Logo'])}" alt="">`:''}<strong>${esc(game[s==='home'?'Home Team':'Away Team'])}</strong></div>`;
  const empty=message=>`<p class="extra-empty">${t(message)}</p>`;
  const compact=['cta','sponsors','powerplay'].includes(layer);
  const shell=(content,footer='')=>`<main class="extra-layer ${compact?'corner-layer '+esc(corner):''}" data-layer="${esc(layer)}"><div class="extra-kicker">${t(['sponsors','announcement'].includes(layer)?'Partner přenosu':extraNames[layer])}</div>${content}${footer?`<footer>${footer}</footer>`:''}</main>`;
  if(layer==='cta'||layer==='sponsors'||layer==='announcement'){
    const hms=layer!=='cta'&&settings.partnerSource==='hms';
    const available=hms?(settings.sponsorCatalog?.org===org?teamPartners(settings.sponsorCatalog,game,rawSide,items,settings.partnerScope):[]):eligibleAssets(items,{org,gameId:game.ID,homeId:game.homeId,awayId:game.awayId,side:rawSide,kind:layer==='cta'?'cta':'sponsor'});
    const list=assetId?available.filter(a=>a.id===assetId):available,item=list[rotationIndex%list.length];
    if(!item)return hms?'':shell(empty('Pro tento výběr není nastavená žádná položka.'));
    let host='';try{host=new URL(item.url).hostname;}catch{}
    return shell(`<article class="asset-card">${item.image?`<img class="${layer==='cta'?'qr-image':'sponsor-image'}" src="${esc(item.image)}" alt="${esc(item.title)}">`:''}<div><h2>${esc(item.title)}</h2>${item.claim?`<p>${esc(item.claim)}</p>`:''}${host?`<small>${esc(host)}</small>`:''}</div></article>`,layer==='cta'?t('Načtěte QR kód fotoaparátem'):hms&&settings.partnerScope==='organization'?`${t('Partner organizace')} · ${esc(org)}`:hms?`${t('Partner týmu')} · ${esc(game[side==='away'?'Away Team':'Home Team'])}`:t('Partner přenosu'));
  }
  const context=game.context;
  if(!context)return shell(empty('Načítám kontext týmu…'));
  const data=context.teams?.[side],scope=`${esc(context.scope?.competition??game.Competition??'')} · ${esc(context.scope?.season??'')}`;
  const historyNote=`${t('Uložené zápasy před tímto utkáním')} · ${data?.games??0} ${t('zápasů')} · ${scope}${context.historyTruncated?' · '+t('Výběr je omezený na 500 zápasů'):''}`;
  if(layer==='next'){
    const rows=context.next?.[side]??[];
    return shell(`${team(side)}${context.nextAvailable?(rows.length?`<ol class="fixture-list">${rows.map(g=>`<li><div class="fixture-date">${esc(g.date.split('-').reverse().join('. '))}<b>${esc(g.time??'—')}</b></div><div><strong>${esc(g.home.name)} <span>—</span> ${esc(g.away.name)}</strong><small>${esc(g.venue??'')} · ${esc(g.group?.name??'')}</small></div></li>`).join('')}</ol>`:empty('V následujících 14 dnech není další zápas.')):empty('Program HMS nyní není dostupný.')}`,`${t('Program HMS · následujících 14 dnů')} · ${scope}`);
  }
  if(layer==='powerplay'){
    const row=(s,type)=>{
      const stats=context.teams?.[s]?.specialTeams,isPP=type==='PP',value=stats?.available?(isPP?stats.ppPercentage:stats.pkPercentage):null;
      return `<section class="special-row">${team(s)}<div><b>${type}</b><strong>${value===null?'—':value.toFixed(1)+' %'}</strong></div><p>${stats?.available?isPP?`${stats.goals} ${t('gólů')} / ${stats.opportunities} ${t('přesilovek')}`:`${stats.conceded} ${t('inkasovaných')} / ${stats.shorthanded} ${t('oslabení')}`:t('Spolehlivý výpočet není dostupný.')} <small>(${stats?.covered??0}/${stats?.total??0} ${t('zápasů')})</small></p></section>`;
    };
    return shell(`<h2 class="advantage-title">${t('Přesilovka')}</h2>${row(side,'PP')}${row(opponent,'PK')}`,`${t('Historie uložených zápasů')} · ${scope}`);
  }
  if(!context.historyAvailable||!data)return shell(`${team(side)}${empty('Historie týmu není dostupná.')}`);
  if(layer==='leaders'){
    const metricLabel={goals:'Góly',assists:'Asistence',points:'Body'}[metric]??'Góly';
    const players=[...(data.players??[])].sort((a,b)=>(b[metric]??0)-(a[metric]??0)||b.points-a.points||a.name.localeCompare(b.name)).slice(0,5);
    return shell(`${team(side)}<h2 class="leader-heading">TOP 5 · ${t(metricLabel)}</h2>${players.length?`<ol class="leader-list">${players.map((p,i)=>`<li><b class="leader-rank">${i+1}</b>${p.imageUrl?`<img class="player-portrait" src="${esc(p.imageUrl)}" alt="">`:'<span class="portrait-placeholder" aria-hidden="true">●</span>'}<div><strong>${esc(p.name)}</strong><small>${p.goals} ${t('Góly')} · ${p.assists} ${t('Asistence')} · ${p.games} ${t('zápasů')}</small></div><b class="leader-number">${p[metric]??0}</b></li>`).join('')}</ol>`:empty('Zatím nejsou uložené statistiky hráčů.')}`,historyNote);
  }
  if(layer==='results')return shell(`${team(side)}<div class="form-summary"><span>${data.games} ${t('Zápasy')}</span><span>${data.wins} ${t('Výhry')}</span><span>${data.draws} ${t('Remízy')}</span><span>${data.losses} ${t('Prohry')}</span></div>${data.results.length?`<ol class="fixture-list">${data.results.map(g=>`<li><div class="fixture-date">${esc(g.date.split('-').reverse().join('. '))}<b class="result-badge">${g.result}</b></div><div><strong>${esc(g.home.name)} <span>—</span> ${esc(g.away.name)}</strong></div><b class="fixture-score">${g.home.score}:${g.away.score}</b></li>`).join('')}</ol>`:empty('Zatím nejsou uložené výsledky.')}`,historyNote);
  return '';
}
