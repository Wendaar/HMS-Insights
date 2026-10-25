import {appsForOrganization, repository, gameReportUrl} from './registry.js';
import {publicOutputUrl} from '../public-output.js';
export const validId = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value??'');
const stage=(id,label,app,kind='open',extra={})=>({id,label,app,kind,...extra});
export const branches=[
  {id:'operations',name:'Operations · provoz a uzávěrky',color:'cyan',nodes:[stage('operations','HMS Operations','operations')]},
  {id:'games',name:'Zápasy & reporty',color:'blue',nodes:[stage('games-view','Games View','games-view'),stage('game-report','Game Report','game-center')]},
  {id:'broadcast',name:'OBS Broadcast',color:'violet',nodes:[stage('obs-definition','Broadcast Definition','broadcast','manage',{note:'Nastavení je součástí Broadcast Studia.'}),stage('obs-studio','Broadcast Studio','broadcast'),stage('obs-output','OBS Output','broadcast','output')]},
  {id:'insights',name:'Insights',color:'cyan',nodes:[stage('insights-definition','Insights Definition','insights-definition','manage'),stage('insights-public','Insights Public','insights-public'),stage('insights-archive','Insights Archive','insights-archive')]},
  {id:'social',name:'Social Studio',color:'pink',nodes:[stage('social-setup','Social Content Setup','studio','manage'),stage('social-studio','Social Studio','studio'),stage('social-output','Social Content Output','studio','export',{note:'Grafiky se exportují ze Studia jako PNG. Samostatná veřejná galerie zatím není.'})]},
  {id:'awards',name:'Awards',color:'amber',nodes:[stage('awards-definition','Awards Definition',null),stage('all-stars','All Stars Month','all-stars'),stage('hall-of-fame','Hall of Fame','hall-of-fame')]},
  {id:'gameshow',name:'Game Show',color:'pink',nodes:[stage('gameshow-definition','Game Show Definition',null,'open',{note:'Plán: hudba týmu, goalhorn, song a hlas hlasatele.'}),stage('gameshow-control','Game Show Control',null)]},
  {id:'sponsors',name:'Sponsors · napříč nástroji',color:'amber',nodes:[stage('sponsor-definition','Sponzoři z HMS','sponsors-catalog','open',{note:'Čtecí katalog z nové vrstvy HMS API. Evidence se spravuje v HMS; sjednocení všech nástrojů je další krok.'}),stage('sponsor-broadcast','Partneři v Broadcastu',null,'open',{note:'Rozšíření sponzorů je v samostatném rozpracovaném náhledu.'}),stage('sponsor-output','Broadcast / Social / Web',null)]},
  {id:'players',name:'Hráči & porovnání',color:'cyan',nodes:[stage('player-cards','Player Cards','player-cards'),stage('team-comparison','Team Comparison','team-comparison'),stage('playoff-players','Playoff Players','playoff-players')]},
  {id:'competition',name:'Soutěže & fanoušci',color:'violet',nodes:[stage('betting','Betting · Sázkovka','betting'),stage('playoff-bracket','Playoff pavouk','playoff-bracket'),stage('calendar','Kalendář','calendar')]},
  {id:'data',name:'Data & infrastruktura',color:'blue',nodes:[stage('api','HMS API','connections','github'),stage('engine','Data Engine','data-engine','github'),stage('database','Databáze','database','github')]},
  {id:'development',name:'Vývoj & provoz',color:'slate',nodes:[stage('code','Code · GitHub','repository'),stage('deploy','Deploy','deploy'),stage('security','Security','security','github')]},
];
branches.unshift(branches.splice(branches.findIndex(b=>b.id==='sponsors'),1)[0]);
export function mapForOrganization(org){
  const apps=new Map(appsForOrganization(org).map(a=>[a.id,a]));
  return branches.map(branch=>({...branch,nodes:branch.nodes.map(node=>{
    const app=apps.get(node.app),href=app?.links[node.kind]??(node.kind==='open'?app?.links.manage:null);
    const special=app&&app.status!=='prepared'&&['output','export'].includes(node.kind);
    const status=!app||app.status==='prepared'||app.status==='missing'?'Planned':app.status==='partial'||special?'Beta':'Ready';
    return {...node,application:app,status,href:href??null,note:node.note??app?.note??(!app?'Zatím plánováno. Odkaz není připojený.':'')};
  })}));
}
// Only forward parameters the destination actually supports. Never rewrite external URLs.
export function nodeUrl(node,org,context={}){
  if(node.status==='Planned')return null;
  if(node.id==='game-report')return validId(context.gameId)?gameReportUrl(org,context.gameId):null;
  if(node.id==='games-view'&&/^\/games\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(context.gamesPath??''))return publicOutputUrl(context.gamesPath);
  if(node.id==='games-view')return validId(context.seasonId)?publicOutputUrl('/game-center?'+new URLSearchParams({seasonId:context.seasonId,lang:'cs'})):null;
  if(node.kind==='output')return validId(context.gameId)?publicOutputUrl('/broadcast/index.html?'+new URLSearchParams({org:org.toUpperCase(),game:context.gameId,mode:'overlay',source:'hms',lang:'cs'})):null;
  if(node.kind==='export')return node.application?.links.open??null;
  if(!node.href)return null;
  if(node.href.startsWith('/broadcast/')&&validId(context.gameId)){
    const url=new URL(node.href,'https://hms.local');url.searchParams.set('game',context.gameId);return url.pathname+url.search;
  }
  return node.href;
}
export function readContext(storage,org){
  try{
    const data=JSON.parse(storage.getItem('hms-map-v2:'+org));
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    return {leagues:Array.isArray(data.leagues)?data.leagues.filter(l=>l&&typeof l.name==='string'&&l.name.length<=100&&(!l.seasonId||validId(l.seasonId))).slice(-40):[],
      league:typeof data.league==='string'?data.league.slice(0,100):'',gameId:validId(data.gameId)?data.gameId:'',
      gameLabel:typeof data.gameLabel==='string'?data.gameLabel.slice(0,240):'',
      work:['all','broadcast','social','games','data'].includes(data.work)?data.work:'all'};
  }catch{return {};}
}
export function writeContext(storage,org,data){try{storage.setItem('hms-map-v2:'+org,JSON.stringify(data));return true;}catch{return false;}}
export const codeLink=path=>`${repository}/blob/main/${path}`;
