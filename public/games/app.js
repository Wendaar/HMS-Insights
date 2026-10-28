import {sportingImage} from '../game-report-media.js';
import {publicOutputUrl} from '../public-output.js';
import {gameReportNavigation} from './navigation.js';
import {reportLanguage,reportLocale} from '../game-report-i18n.js';
const $=id=>document.getElementById(id),filters=['Today','Yesterday','+7 days','-7 days','Past','Future'];
const words={cs:{games:'Zápasy',tba:'Tým bude určen',Today:'Dnes',Yesterday:'Včera','+7 days':'+7 dní','-7 days':'−7 dní',Past:'Minulé',Future:'Budoucí',Date:'Vybrané datum',group:'Skupina',phase:'Fáze',team:'Tým',date:'Datum',search:'Vyhledat',all:'Vše',find:'Hledat',placeholder:'Tým, stadion, jméno…',refresh:'Obnovit ↻',loading:'Načítání zápasů…',empty:'V tomto období a výběru nejsou žádné zápasy. Zkuste jiný den nebo upravte filtry.',error:'Zápasy se nepodařilo načíst. Zkuste přehled obnovit.',invalid:'Zkontrolujte Season ID a filtry v odkazu.',missing:'Pro otevření přehledu je potřeba seasonId v URL. Můžete použít stejné Season ID jako v původním přehledu HMS.',rate:'HMS dočasně omezuje požadavky. Vyčkejte prosím a obnovte přehled.',final:'Konečný',live:'Živě',scheduled:'Plánováno',cancelled:'Zrušeno',postponed:'Odloženo',unknown:'Zápas',report:'Game Report →',hms:'Detail v HMS ↗',referee:'Rozhodčí',timekeeper:'Časoměřič',older:'← Starší',newer:'Novější →',previous:'← Předchozí',next:'Další →',source:'Zdroj: HMS · Časy dle zápisu HMS · Načteno',availability:'Game Report je dostupný u již importovaných zápasů. Ostatní zápasy mají odkaz na veřejný detail HMS.',selected:'Vybraný filtr',of:'z'},en:{games:'Games',tba:'Team to be confirmed',Today:'Today',Yesterday:'Yesterday','+7 days':'+7 days','-7 days':'−7 days',Past:'Past',Future:'Future',Date:'Selected date',group:'Group',phase:'Phase',team:'Team',date:'Date',search:'Search',all:'All',find:'Search',placeholder:'Team, venue, name…',refresh:'Refresh ↻',loading:'Loading games…',empty:'No games match this period and selection. Try another date or adjust the filters.',error:'Games could not be loaded. Please refresh the schedule.',invalid:'Please check the Season ID and filters in the link.',missing:'A seasonId is required in the URL. Use the same Season ID as the original HMS schedule.',rate:'HMS is temporarily limiting requests. Please wait and refresh the schedule.',final:'Final',live:'Live',scheduled:'Scheduled',cancelled:'Cancelled',postponed:'Postponed',unknown:'Game',report:'Game Report →',hms:'HMS details ↗',referee:'Referees',timekeeper:'Timekeepers',older:'← Earlier',newer:'Later →',previous:'← Previous',next:'Next →',source:'Source: HMS · Times as entered in HMS · Loaded',availability:'Game Reports are available for imported games. Other games link to their public HMS details.',selected:'Selected filter',of:'of'}};
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let params=new URLSearchParams(location.search),lang=reportLanguage(params.get('lang')),last=null,controller=null,requestId=0;
const t=key=>words[lang][key]??key;
const dateLabel=(date,long=false)=>new Intl.DateTimeFormat(reportLocale(lang),{day:'numeric',month:long?'long':'short',year:'numeric',...(long?{weekday:'long'}:{}),timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
let canonicalPath=location.pathname,prettyRoute=false,navigationVersion=0;
const periods={today:'Today',yesterday:'Yesterday','next-week':'+7 days','last-week':'-7 days',past:'Past',future:'Future',date:'Date'};
function updateUrl(){
 const shown=new URLSearchParams(params);
 if(prettyRoute){shown.delete('seasonId');const filter=shown.get('filter');shown.delete('filter');const period=Object.entries(periods).find(([,value])=>value===filter)?.[0];if(period&&period!=='today')shown.set('period',period);const defaultLang=canonicalPath.split('/')[2]==='euchl'?'en':'cs';if(shown.get('lang')===defaultLang)shown.delete('lang');}
 const query=shown.toString();history.replaceState(null,'',canonicalPath+(query?'?'+query:''));
}
function labels(){
  document.documentElement.lang=lang;document.title=t('games')+' | HMS Game Center';$('heading').textContent=t('games');
  document.querySelectorAll('[data-label]').forEach(node=>node.textContent=t(node.dataset.label));
  $('search-button').textContent=t('find');$('search').placeholder=t('placeholder');$('refresh').textContent=t('refresh');$('copy-link').textContent=lang==='en'?'Copy link':'Kopírovat odkaz';
  $('earlier').textContent=t('older');$('later').textContent=t('newer');$('previous').textContent=t('previous');$('next').textContent=t('next');
  document.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===lang)));
  $('period-tabs').replaceChildren(...filters.map(filter=>{const button=document.createElement('button');button.type='button';button.textContent=t(filter);button.dataset.filter=filter;button.setAttribute('aria-pressed',String(filter===(params.get('filter')??'Today')));return button;}));
}
function optionList(id,items,key){
  const node=$(id),value=params.get(key)??'',previous=node.selectedOptions[0]?.textContent;
  node.replaceChildren(new Option(t('all'),''),...items.map(item=>new Option(item.name,item.id)));
  if(value&&!items.some(item=>item.id===value))node.append(new Option(previous&&previous!==t('all')?previous:t('selected'),value));
  node.value=value;
}
function status(game){if(game.live)return t('live');return t(game.status==='FINISHED'?'final':['NOT PLAYED','SCHEDULED'].includes(game.status)?'scheduled':game.status==='CANCELLED'?'cancelled':game.status==='POSTPONED'?'postponed':'unknown');}
function logo(team){const src=sportingImage(team.logoUrl),initials=(team.name??'').split(/\s+/).slice(0,2).map(v=>v[0]).join('');return `<span class="team-logo"><span aria-hidden="true">${html(initials)}</span>${src?`<img src="${html(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</span>`;}
function gameRow(game){
  const scored=Number.isFinite(game.home.score)&&Number.isFinite(game.away.score),score=scored?`${game.home.score} : ${game.away.score}`:'—';
  const report=gameReportNavigation(game.id,lang,params.get('embed')==='1');
  const hms='https://prod.hms.wootera.net/embed/game?'+new URLSearchParams({gameId:game.id,lang});
  const details=[game.venue,game.group.name,game.phase.name].filter(Boolean).map(value=>`<span>${html(value)}</span>`).join('');
  const staff=[[t('referee'),game.referee],[t('timekeeper'),game.timekeeper]].filter(([,value])=>value).map(([label,value])=>`<span class="staff">${html(label)}: ${html(value)}</span>`).join('');
  return `<article class="game-row"><div class="game-time">${game.time?`<time datetime="${html(game.date+'T'+game.time)}">${html(game.time)}</time>`:''}<span class="status ${game.live?'live':''}">${html(status(game))}</span></div><div class="team home">${logo(game.home)}<strong>${html(game.home.name??t('tba'))}</strong></div><span class="score ${scored?'':'unplayed'}">${html(score)}</span><div class="team away">${logo(game.away)}<strong>${html(game.away.name??t('tba'))}</strong></div><div class="game-action">${game.reportAvailable?`<a class="report-link" href="${html(report.href)}"${report.target?' target="_blank" rel="noopener noreferrer"':''} aria-label="${html(t('report')+' '+game.home.name+' — '+game.away.name)}">${html(t('report'))}</a>`:`<a class="hms-link" href="${html(hms)}" target="_blank" rel="noopener noreferrer">${html(t('hms'))}</a>`}</div><div class="game-meta">${details}${game.name?`<span class="game-name">${html(game.name)}</span>`:''}${staff}</div></article>`;
}
function draw(data){
  labels();$('competition').textContent=data.competition??'';$('season').textContent=data.season??'';
  $('period-label').textContent=t(data.filter);$('range').textContent=data.from===data.to?dateLabel(data.from,true):dateLabel(data.from)+' — '+dateLabel(data.to);
  optionList('group',data.options.groups,'groupId');optionList('phase',data.options.phases,'phaseId');optionList('team',data.options.teams,'teamId');
  $('date').value=params.get('date')??'';$('search').value=params.get('q')??'';
  const dates=new Map();for(const game of data.items){if(!dates.has(game.date))dates.set(game.date,[]);dates.get(game.date).push(game);}
  $('games').innerHTML=[...dates].map(([date,games])=>`${data.from!==data.to?`<h3 class="date-heading">${html(dateLabel(date,true))}</h3>`:''}${games.map(gameRow).join('')}`).join('');
  $('message').className='';$('message').textContent=data.items.length?'':t('empty');
  $('pagination').hidden=!data.total;$('previous').disabled=data.offset===0;$('next').disabled=!data.hasMore;
  $('page-count').textContent=`${data.total?data.offset+1:0}–${Math.min(data.offset+data.items.length,data.total)} ${t('of')} ${data.total}`;
  const windowed=['Past','Future'].includes(data.filter);$('earlier').hidden=!windowed;$('later').hidden=!windowed;
  $('earlier').disabled=data.filter==='Future'&&data.windowPage===0||data.filter==='Past'&&data.windowPage>=520;
  $('later').disabled=data.filter==='Past'&&data.windowPage===0||data.filter==='Future'&&data.windowPage>=520;
  $('source').textContent=t('source')+' '+new Intl.DateTimeFormat(reportLocale(lang),{timeZone:'Europe/Prague',dateStyle:'short',timeStyle:'short'}).format(new Date(data.readAt));
  $('availability').textContent=t('availability');
}
async function load(){
  labels();if(!params.get('seasonId')){$('message').textContent=t('missing');$('message').className='error';return;}
  controller?.abort();controller=new AbortController();const current=++requestId;
  document.querySelector('.results').setAttribute('aria-busy','true');$('message').className='';$('message').textContent=t('loading');
  try{
    const query=new URLSearchParams(params);query.set('view','games');
    const response=await fetch('/api/game-summary?'+query,{headers:{accept:'application/json'},signal:controller.signal});
    if(!response.ok)throw Object.assign(new Error('unavailable'),{status:response.status});
    const data=await response.json();if(current!==requestId)return;
    if(data.seasonId!==params.get('seasonId')?.toLowerCase())throw new Error('Wrong season');
    if(!['cs','en'].includes(params.get('lang')))lang=reportLanguage(null,{competition:data.competition});
    last=data;draw(data);
  }catch(error){if(error.name==='AbortError'||current!==requestId)return;$('message').className='error';$('message').textContent=t(error.status===400?'invalid':error.status===429?'rate':'error');}
  finally{if(current===requestId)document.querySelector('.results').setAttribute('aria-busy','false');}
}
function change(values){for(const [key,value]of Object.entries(values)){if(value===null||value==='')params.delete(key);else params.set(key,String(value));}if(!Object.hasOwn(values,'offset'))params.delete('offset');updateUrl();load();}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{lang=button.dataset.lang;params.set('lang',lang);updateUrl();if(last)draw(last);else labels();}));
$('period-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button)change({filter:button.dataset.filter,windowPage:null,date:null});});
for(const [id,key]of [['group','groupId'],['phase','phaseId'],['team','teamId']])$(id).addEventListener('change',()=>change({[key]:$(id).value}));
$('date').addEventListener('change',()=>{if($('date').value)change({filter:'Date',date:$('date').value,windowPage:null});});
$('filters').addEventListener('submit',event=>{event.preventDefault();change({q:$('search').value});});
$('previous').addEventListener('click',()=>change({offset:Math.max(0,Number(params.get('offset')??0)-20)}));
$('next').addEventListener('click',()=>change({offset:Number(params.get('offset')??0)+20}));
$('earlier').addEventListener('click',()=>change({windowPage:Number(params.get('windowPage')??0)+(params.get('filter')==='Past'?1:-1)}));
$('later').addEventListener('click',()=>change({windowPage:Number(params.get('windowPage')??0)+(params.get('filter')==='Past'?-1:1)}));
$('refresh').addEventListener('click',load);
window.addEventListener('popstate',initialize);
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement)event.target.hidden=true;},true);
async function initialize(){
 const navigation=++navigationVersion;
 canonicalPath=location.pathname;prettyRoute=/^\/games\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/.test(canonicalPath);
 params=new URLSearchParams(location.search);if(params.has('period')){params.set('filter',periods[params.get('period')]??'invalid');params.delete('period');}
 lang=reportLanguage(params.get('lang'),{competition:prettyRoute&&canonicalPath.split('/')[2]==='euchl'?'EUCHL':''});
 if(prettyRoute){
  try{
   const org=canonicalPath.split('/')[2],response=await fetch('/api/studio?'+new URLSearchParams({catalog:'leagues',org}),{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();const catalog=await response.json();if(navigation!==navigationVersion)return;if(catalog.org?.toLowerCase()!==org)throw Error();
   const item=catalog.items?.find(item=>item.gamesPath===canonicalPath.replace(/\/$/,''));if(!item)throw Error();params.set('seasonId',item.seasonId);
  }catch{labels();$('message').className='error';$('message').textContent=lang==='en'?'This season link is unavailable. Open the Control Center to choose another season.':'Odkaz na tuto sezonu není dostupný. Vyberte jinou sezonu v rozcestníku.';return;}
 }
 await load();if(navigation!==navigationVersion)return;
 if(!prettyRoute&&params.get('seasonId')){
  try{
   const response=await fetch('/api/studio?'+new URLSearchParams({catalog:'season-link',seasonId:params.get('seasonId')}),{signal:AbortSignal.timeout(8000)});
   if(response.ok){const data=await response.json();if(navigation!==navigationVersion)return;if(/^\/games\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(data.path??'')){canonicalPath=data.path;prettyRoute=true;updateUrl();}}
  }catch{/* Original UUID links remain usable when the optional readable alias is unavailable. */}
 }
}
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(publicOutputUrl(location.href));$('copy-status').textContent=lang==='en'?'Link copied':'Odkaz zkopírován';}catch{$('copy-status').textContent=(lang==='en'?'Copy this link: ':'Zkopírujte tento odkaz: ')+publicOutputUrl(location.href);}});
initialize();
