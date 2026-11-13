import {sportingImage} from './game-report-media.js';
import {reportLocale} from './game-report-i18n.js';
const known=value=>value!=null&&value!==''&&!/^(neznám|neuveden|unknown|n\/a)/i.test(String(value));
// The Game Report card with a caller-owned loader and context.
export function createPlayerCard({dialog,title,content,loadCard,knownPlayer=()=>null,lang='cs',localize=()=>{}}){
 const cache=new Map();let generation=0;
 dialog.addEventListener('close',()=>{generation++;});
 return async (id,personOverride)=>{
  if(!/^[a-f0-9-]{36}$/i.test(id))return;
  const request=++generation,person=personOverride??knownPlayer(id),key=id+':'+(personOverride?.teamId??'');
  title.textContent=person?.name??(lang==='en'?'Player':'Hráč');content.textContent=lang==='en'?'Loading statistics…':'Načítání statistik…';
  localize(dialog);if(!dialog.open)dialog.showModal();
  try{
   let card=cache.get(key);if(!card){card=await loadCard(id,personOverride);cache.set(key,card);}
   if(request!==generation||!dialog.open)return;
   if(!card.available){content.textContent=lang==='en'?'Player statistics are not available yet.':'Souhrnné statistiky tohoto hráče zatím nejsou k dispozici.';return;}
   title.textContent=card.name||person?.name||'Hráč';renderPlayerCard(content,card,person,lang);localize(dialog);
  }catch{if(request===generation&&dialog.open)content.textContent=lang==='en'?'Statistics could not be loaded. Open the card to retry.':'Statistiky se nyní nepodařilo načíst. Zkuste kartu otevřít znovu.';}
 };
}
export function renderPlayerCard(content,card,knownPlayer,lang='cs'){
    const fragment=document.createDocumentFragment();
    const image=sportingImage(knownPlayer?.imageUrl);
    if(image){const photo=document.createElement('img');photo.src=image;photo.alt='';photo.className='player-card-photo';photo.referrerPolicy='no-referrer';fragment.append(photo);}
    const context=document.createElement('p');context.className='player-scope';context.textContent=[card.scope.competition,card.scope.season,card.scope.group].filter(known).join(' · ');fragment.append(context);
    const labels=card.role==='goalie'?{GP:'Zápasy',Svs:'Zákroky',GA:'Inkasované góly',GAA:'GAA',SvP:'Úspěšnost %',SO:'Čistá konta',W:'Výhry',D:'Remízy',L:'Prohry',PIM:'Trestné minuty'}:{GP:'Zápasy',G:'Góly',A:'Asistence',P:'Body',PIM:'Trestné minuty',PPG:'PP góly',SHG:'SH góly',Stars:'Hvězda zápasu'};
    if(card.rank&&card.scopeLabel!=='selection'){
      const rank=document.createElement('p');rank.className='player-rank';rank.textContent=`#${card.rank} v bodování soutěže`;fragment.append(rank);
      if(card.rank<=10&&card.role!=='goalie'&&card.source==='hms'){
        const badge=document.createElement('div');badge.className=`league-badge ${card.rank===1?'league-leader':'league-top'}`;
        const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=card.rank===1?'★':'◆';
        const text=document.createElement('span');text.textContent=card.rank===1?'LÍDR BODOVÁNÍ':'TOP 10 BODOVÁNÍ';
        const scope=document.createElement('small');scope.textContent='V této skupině soutěže';text.append(scope);badge.append(icon,text);fragment.append(badge);
      }
    }
    const grid=document.createElement('div');grid.className='player-stat-grid';
    for(const [key,label]of Object.entries(labels)){if(!Number.isFinite(card.stats[key]))continue;const cell=document.createElement('div'),value=document.createElement('strong'),name=document.createElement('small');value.textContent=new Intl.NumberFormat(reportLocale(lang),{maximumFractionDigits:2}).format(card.stats[key]);name.textContent=label;cell.append(value,name);grid.append(cell);}fragment.append(grid);
    const source=document.createElement('p');source.className='map-caption';source.textContent=(card.source==='hms'?'Souhrnné statistiky HMS pro tuto skupinu soutěže.':'Součet z dosud načtených zápasů v této skupině soutěže.')+(card.asOf?(lang==='en'?' As of ':' K ')+new Intl.DateTimeFormat(reportLocale(lang),{timeZone:'Europe/Prague'}).format(new Date(card.asOf)):'');if(card.scopeLabel==='selection')source.textContent=lang==='en'?'HMS statistics for this selection.':'Souhrnné statistiky HMS pro tento výběr.';fragment.append(source);

 content.replaceChildren(fragment);
}
