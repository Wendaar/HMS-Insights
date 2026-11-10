// Local, in-memory QA only. Never reads or writes production data.
import {createServer} from 'node:http';
import {server as application} from '../src/server.js';
import {createPublicPortalHandler} from '../src/web/public-portal-handler.js';
import {createWidgetsHandler} from '../src/web/widgets-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_PHM_ORGANIZATION_ID:id(1),HMS_PHM_API_TOKEN:'local-fixture',HMS_PHM_PORTAL_ADMIN_SECRET:'widget-preview'};
const season={seasonId:id(10),competitionId:id(11),competition:'PHM Cup',season:'2026/27',name:'PHM Cup · 2026/27'};
const config={title:'PHM Cup · Widgets V1',description:'Lokální ověření na testovacích datech.',seasonIds:[id(10)],defaultSeasonId:id(10),sections:['home','system','teams','games'],color:'#087b91',lang:'cs',extras:'',widgets:[{widgetType:'leaders',widgetInstanceId:'points',metric:'points',limit:5,display:{mode:'standard'}},{widgetType:'leaders',widgetInstanceId:'goals',metric:'goals',limit:10},{widgetType:'leaders',widgetInstanceId:'gaa',metric:'gaa',limit:10},{widgetType:'leaders',widgetInstanceId:'group-assists',metric:'assists',placement:'group'}]};
let instance={revision:1,draft:structuredClone(config),published:structuredClone(config),publishedAt:'2026-11-10'};
const store={get:async()=>structuredClone(instance),save:async(o,k,d,r)=>{if(r!==instance.revision)return null;instance={...instance,draft:structuredClone(d),revision:r+1};return structuredClone(instance);},publish:async(o,k,r)=>{if(r!==instance.revision)return null;instance={...instance,published:structuredClone(instance.draft),revision:r+1};return structuredClone(instance);},unpublish:async(o,k,r)=>{if(r!==instance.revision)return null;instance={...instance,published:null,revision:r+1};return structuredClone(instance);}};
const names=['Jiří Říha','Štěpán Němec','Vojtěch Ďuriš','Martin Černý','Tomáš Šťastný','Ondřej Žáček','Ľuboš Ťažký'];
const players=names.map((name,i)=>({PlayerId:id(100+i),TeamId:id(i%2?21:20),FirstName:name.split(' ')[0],LastName:name.split(' ')[1],GP:7,G:10-i,A:i===2?5:4,P:[14,13,12,12,10,9,8][i],PIM:i*2,Stars:i,W:7-i,GAA:i*.5,SvP:99-i,GA:i,Svs:25,SO:i===0?3:0,JerseyNumber:i+10,Position:'F'}));
const directory={teams:[{id:id(20),name:'PHM A',groupIds:[id(30)]},{id:id(21),name:'PHM B',groupIds:[id(30),id(31)]},{id:id(22),name:'PHM Empty',groupIds:[id(30)]}],groups:[{id:id(30),name:'Divize A',color:'#e78b34',teamCount:2,phases:[{id:id(40),name:'Základní část'}]},{id:id(31),name:'Test API error',phases:[]}],venues:[],teamCount:3};
const options={env,store,portalCatalog:async()=>({items:[season]}),portalDirectory:async()=>directory,portalBranding:async()=>null,loadSponsorCatalog:async()=>({items:[],teams:[]}),fetchImpl:async url=>({ok:url.searchParams.get('groupId')!==id(31),json:async()=>players})};
const portal=createPublicPortalHandler(options),widgets=createWidgetsHandler(options),fallback=application.listeners('request')[0];
export const preview=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api/portal'||u.pathname==='/api/widgets'){
  req.query=Object.fromEntries(u.searchParams);if(req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;req.body=text;}
  const response={setHeader:(k,v)=>res.setHeader(k,v),status(c){res.statusCode=c;return this;},json(v){res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(v));},send(v){res.end(v);}};
  return (u.pathname==='/api/portal'?portal:widgets)(req,response);
 }
 return fallback(req,res);
});
if(process.argv.includes('--serve'))preview.listen(3017,'127.0.0.1',()=>console.log('Widget QA: http://127.0.0.1:3017/league/phm · local access code: widget-preview'));
