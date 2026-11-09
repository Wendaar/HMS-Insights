import {appsForOrganization, repository, gameReportUrl,organizationById} from './registry.js';
import {publicOutputUrl} from '../public-output.js';
export const validId = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value??'');
const stage=(id,label,app,kind='open',extra={})=>({id,label,app,kind,...extra});
export const branches=[
 {id:'administration',name:'Administration',color:'cyan',nodes:[stage('operations','HMS Operations','operations')]},
 {id:'website',name:'Web / Hub',color:'blue',nodes:[stage('portal-definition','Site Builder','public-portal','manage',{note:'Nastavení webu, náhled a publikace na jednom místě.'}),stage('portal-public','League Page · veřejný web','public-portal','public')]},
 {id:'competition',name:'Competition basics',color:'blue',nodes:[stage('games-view','Games View','games-view'),stage('player-cards','Player Cards','player-cards'),stage('statistics','Statistics','statistics'),stage('standings','Standings','standings'),stage('team-profiles','Team Profiles','team-profiles'),stage('playoff-bracket','Playoff pavouk','playoff-bracket'),stage('playoff-players','Hráči do playoff','playoff-players')]},
 {id:'broadcast',name:'Broadcast',color:'violet',nodes:[stage('obs-studio','Broadcast Studio','broadcast'),stage('virtual-camera','HERO Virtual Camera','virtual-camera')]},
 {id:'content',name:'Content creation',color:'pink',nodes:[stage('social-studio','Social Media Studio','studio','open',{note:'Game Day, Team Compare, Insights grafiky, náhledy a export PNG.'}),stage('photo-archive','Photo Archive','photo-archive'),stage('betting','Sázkovka','betting')]},
 {id:'sponsors',name:'Sponsors',color:'amber',nodes:[stage('sponsor-definition','Sponsors','sponsors-catalog')]},
 {id:'gameshow',name:'Media & Game Show',color:'pink',nodes:[stage('gameshow-definition','Media Mapping','media-mapping'),stage('gameshow-control','LIVE Show Control','show-control')]},
 {id:'awards',name:'Awards & Achievements',color:'amber',nodes:[stage('insights-public','Insights · Public / Archive','insights-public'),stage('all-stars','All Stars','all-stars'),stage('hall-of-fame','Hall of Fame','hall-of-fame')]},
];
export const workBranches={
 administration:['administration','website','competition','sponsors'],
 broadcast:['broadcast','gameshow','sponsors'],
 social:['content','awards','sponsors'],
 games:['competition','awards'],
 data:['administration','website','sponsors'],
};
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
  if(node.kind==='output')return validId(context.gameId)?publicOutputUrl('/broadcast/index.html?'+new URLSearchParams({org:organizationById(org)?.code??org.toUpperCase(),game:context.gameId,mode:'overlay',source:'hms',lang:'cs'})):null;
  if(node.kind==='export')return node.application?.links.open??null;
  if(!node.href)return null;
  if(node.app==='show-control'&&validId(context.gameId)){
    const url=new URL(node.href,'https://hms.local');url.searchParams.set('gameId',context.gameId);return url.pathname+url.search;
  }
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
      work:['all','administration','broadcast','social','games','data'].includes(data.work)?data.work:'all'};
  }catch{return {};}
}
export function writeContext(storage,org,data){try{storage.setItem('hms-map-v2:'+org,JSON.stringify(data));return true;}catch{return false;}}
export const codeLink=path=>`${repository}/blob/main/${path}`;
