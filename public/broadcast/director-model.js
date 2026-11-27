// Presentation contract shared by the V2 controller, compositor and server.
export const directorDefaults=()=>({side:'home',period:'current',page:1,insight:'',corner:'top-left',metric:'points',assetId:'',rotateSeconds:15,partnerSource:'hms',partnerScope:'organization',standingsView:'opponents'});
export const graphics=[
 {id:'opening',phases:['pre'],cs:'Úvod zápasu',en:'Match introduction'},
 {id:'lineup',phases:['pre'],cs:'Starting Lineup',en:'Starting Lineup'},
 {id:'goalies',phases:['pre'],cs:'Brankáři v sestavě',en:'Listed goalies',planned:true},
 {id:'compare',phases:['pre','break'],cs:'Team Compare',en:'Team Compare',planned:true},
 {id:'countdown',phases:['pre'],cs:'Countdown',en:'Countdown',planned:true},
 {id:'periods',phases:['game','break','post'],cs:'Stav / konečný výsledek',en:'Score / final score'},
 {id:'insights',phases:['game'],cs:'Small Insight',en:'Small Insight'},
 {id:'leaders-strip',phases:['game','break'],cs:'TOP 5',en:'TOP 5'},
 {id:'leaders',phases:['pre','game','break','post'],cs:'Lídři týmu · velká grafika',en:'Team leaders · full graphic'},
 {id:'scoresheet',phases:['game','break','post'],cs:'Scoring Summary',en:'Scoring Summary'},
 {id:'powerplay',phases:['game'],cs:'Přesilovka / oslabení',en:'Power Play / Penalty Kill'},
 {id:'standings',phases:['pre','break','post'],cs:'Tabulka soutěže',en:'Standings'},
 {id:'next',phases:['pre','game','break','post'],cs:'Příští zápasy',en:'Next games'},
 {id:'results',phases:['pre','game','break','post'],cs:'Poslední výsledky',en:'Recent results'},
 {id:'announcement',phases:['pre','game','break','post'],cs:'Velké partnerské oznámení',en:'Partner announcement'},
 {id:'cta',phases:['pre','game','break','post'],cs:'QR výzva',en:'QR call to action'},
 {id:'sponsors',phases:['pre','game','break','post'],cs:'Partners · samostatná vrstva',en:'Partners · independent layer',sponsor:true},
 ...[['goal','Goal','Gól'],['goalie-stats','Goalie Statistics','Statistiky brankáře'],['highlights','Highlights','Highlights'],['next-period','Next Period','Další třetina'],['game-stats','Game Statistics','Statistiky zápasu'],['stars','Three Stars','Tři hvězdy'],['mvp','MVP','MVP'],['thanks','Thank You','Poděkování']].map(([id,en,cs])=>({id,en,cs,phases:['goal','goalie-stats'].includes(id)?['game']:['highlights','next-period'].includes(id)?['break']:['post'],planned:true})),
];
export const settingsKeys=Object.keys(directorDefaults()).concat('layer','sponsorRotation','libraryItems','photoChoices');
export function compactPageSize(layer,game,side='home'){
 const match=game?.match;
 if(layer==='lineup'){
  const longest=Math.max(0,...(match?.roster??[]).filter(p=>side==='both'||p.side===side).map(p=>String(p.name??'').length));
  return longest>100?(side==='both'?8:12):longest>60?(side==='both'?12:16):(side==='both'?20:24);
 }
 if(layer==='scoresheet'){
  const longest=Math.max(0,...(match?.goals??[]).filter(g=>side==='both'||g.side===side).map(g=>String(g.scorer?.name??'').length+(g.assists??[]).reduce((n,p)=>n+String(p.name??'').length,0)));
  return longest>180?6:longest>100?8:longest>85?12:16;
 }
 return 8;
}
export function sameGame(a,b){return !!a&&!!b&&a.org===b.org&&String(a.gameId).toLowerCase()===String(b.gameId).toLowerCase();}
export function presentation(state){return Object.fromEntries(settingsKeys.filter(k=>state[k]!==undefined).map(k=>[k,state[k]]));}
export function mixerFromState(state){
 if(state?.directorVersion===2)return structuredClone(state);
 return {...state,directorVersion:2,visible:!!state?.visible,mainVisible:!!state?.visible,sponsors:{...directorDefaults(),layer:'sponsors',corner:'bottom-right',visible:false,sponsorRotation:{enabled:true,showSeconds:15,pauseSeconds:0,startedAt:0}}};
}
export function effectiveLayers(state){
 if(!state?.visible)return {main:false,sponsors:false,covered:false};
 const main=state.mainVisible===true;
 // Sponsors are above MAIN unless the operator explicitly chooses collision hiding.
 const upperCompact=['insights','powerplay','cta','sponsors','leaders-strip'].includes(state.layer)||state.layer==='standings'&&state.standingsView!=='full';
 const mainCorner=state.layer==='insights'?'top-left':state.corner??'top-left';
 const covered=state.sponsors?.stacking==='auto-hide'&&main&&(!upperCompact||mainCorner===(state.sponsors?.corner??'bottom-right'));
 return {main,sponsors:state.sponsors?.visible===true&&!covered,covered:state.sponsors?.visible===true&&covered};
}
export function availability(id,game,{error=false,settings=directorDefaults(),partnerCount=0,libraryReady=false}={}){
 const result=(state,cs,en)=>({state,cs,en,usable:state==='READY'||state==='INCOMPLETE'});
 if(graphics.find(g=>g.id===id)?.planned)return result('UNAVAILABLE','Navazující etapa: chybí bezpečný broadcast adaptér.','Next stage: no verified broadcast adapter.');
 if(!game||error)return result('UNAVAILABLE',error?'Načtení HMS selhalo. Obnovte data.':'Vyberte zápas.','Load a game; retry HMS if unavailable.');
 const m=game.match,side=settings.side==='away'?'away':'home';
 const ready=()=>result('READY','Data jsou připravena.','Data ready.');
 const waiting=()=>result('WAITING FOR DATA','Čekáme na data v HMS.','Waiting for HMS data.');
 const incomplete=()=>result('INCOMPLETE','Část údajů chybí; renderer použije dostupný obsah.','Partial data; available content will be shown.');
 if(id==='opening')return ready();
 if(id==='lineup'){
  if(!m||m.lineupAvailable===false||!m.roster?.some(p=>settings.side==='both'||p.side===side))return waiting();
  const rows=m.roster.filter(p=>settings.side==='both'||p.side===side);
  return rows.some(p=>!p.imageUrl||p.number===null)||settings.side==='both'&&['home','away'].some(s=>!rows.some(p=>p.side===s))?incomplete():ready();
 }
 if(id==='periods')return !m||game.status==='NOT PLAYED'||m.score?.home==null||m.score?.away==null?waiting():settings.period!=='current'&&!m.periods?.length?waiting():m.coverage!=='matches-score'?incomplete():ready();
 if(id==='scoresheet'||id==='insights'){
  if(!m||m.coverage!=='matches-score')return result('UNAVAILABLE','Gólové události nejsou ověřené proti skóre.','Goal events do not match the official score.');
  return id==='scoresheet'?m.goals?.some(g=>settings.side==='both'||g.side===side)?ready():waiting():m.insights?.length?ready():waiting();
 }
 if(['leaders','leaders-strip'].includes(id))return game.league?.leadersAvailable&&game.league.leaders?.[side]?.length?ready():waiting();
 if(id==='standings')return game.league?.standingsAvailable&&game.league.standings?.length?ready():waiting();
 if(id==='next')return game.context?.nextAvailable&&game.context.next?.[side]?.length?ready():waiting();
 if(id==='results')return game.context?.historyAvailable&&game.context.teams?.[side]?.results?.length?ready():waiting();
 if(id==='powerplay')return game.context?.teams?.[side]?.specialTeams?.available?ready():waiting();
 if(['sponsors','announcement','cta'].includes(id))return partnerCount>0?ready():result(libraryReady?'WAITING FOR DATA':'UNAVAILABLE','Vyberte odpovídající partnery nebo doplněk.','Select matching partners or an asset.');
 return waiting();
}
