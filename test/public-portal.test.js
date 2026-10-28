import test from 'node:test';
import assert from 'node:assert/strict';
import {portalSettings,portalCatalog,portalDirectory,portalPartners,portalModule,validatePortalSeasons,portalBranding} from '../src/app/public-portal.js';
import {themeVariables,teamDivisions,seasonMedia} from '../public/league/presentation.js';
import {createPublicPortalHandler,portalStorageNamespace} from '../src/web/public-portal-handler.js';
import {toolStore} from '../src/infrastructure/tool-instances.js';
import {gameReportNavigation} from '../public/games/navigation.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_PHM_ORGANIZATION_ID:id(1),HMS_EUCHL_ORGANIZATION_ID:id(2),HMS_PHM_TOOLS_ADMIN_SECRET:'phm-secret',HMS_EUCHL_TOOLS_ADMIN_SECRET:'euchl-secret'};
const seasons=[{organization_id:id(1),competition_id:id(10),competition_name:'PHM Cup',season_id:id(11),season_name:'2026–2027'},{organization_id:id(1),competition_id:id(12),competition_name:'Other PHM Cup',season_id:id(13),season_name:'2026–2027'}];
const settings=()=>({title:'PHM Cup',description:'Public hub',seasonIds:[id(11)],defaultSeasonId:id(11),sections:['home','teams','games','rules','extras'],color:'#087b91',lang:'cs',logoUrl:'',extras:'<script>privateDraft()</script>'});
test('preview and unknown deployment environments never share the production publication namespace',()=>{
 const production=portalStorageNamespace({VERCEL_ENV:'production'});
 for(const value of [undefined,'','preview','development','unknown'])assert.notEqual(portalStorageNamespace({VERCEL_ENV:value}),production);
});
function memory(){const data=new Map();return {async get(o,s){return structuredClone(data.get(o+s)??null);},async save(o,s,d,r){const old=data.get(o+s);if((old?.revision??0)!==r)return null;const value={draft:structuredClone(d),published:old?.published??null,revision:r+1};data.set(o+s,value);return structuredClone(value);},async publish(o,s,r){const v=data.get(o+s);if(!v||v.revision!==r)return null;v.published=structuredClone(v.draft);v.publishedAt='2026-10-28';v.revision++;return structuredClone(v);},async unpublish(o,s,r){const v=data.get(o+s);if(!v||v.revision!==r)return null;v.published=null;v.revision++;return structuredClone(v);}};}
function harness(extra={}){
 const store=memory(),options={env,store,loadPortalSeasons:async()=>seasons,...extra},handler=createPublicPortalHandler(options);
 const call=async(action,body,query={},secret='phm-secret',headers={})=>{const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;},send(b){this.body=b;return this;}};await handler({method:body?'POST':'GET',query:{org:'phm',action,...query},body,headers:{host:'localhost',authorization:'Bearer '+secret,...headers}},res);return res;};
 return {call,store,options};
}
test('portal validates explicit seasons, navigation visibility and safe logos',()=>{
 assert.equal(portalSettings(settings()).seasonIds[0],id(11));
 for(const patch of [{seasonIds:[]},{seasonIds:[id(99)]},{defaultSeasonId:id(99)},{sections:['teams']},{sections:['home','home']},{sections:['home','unknown']},{color:'red'},{logoUrl:'javascript:alert(1)'},{logoUrl:'https://a:b@example.com/logo.png'},{extras:'x'.repeat(30001)}]){
  if(patch.seasonIds?.[0]===id(99))continue;assert.throws(()=>portalSettings({...settings(),...patch}),TypeError);
 }
});
test('catalog and directory reject foreign rows and use bound organization/season SQL',async()=>{
 const options={env,loadPortalSeasons:async()=>seasons},catalog=await portalCatalog('phm',options);assert.equal(catalog.items.length,2);assert.equal(catalog.items.find(s=>s.seasonId===id(11)).competitionId,id(10));
 await assert.rejects(()=>portalCatalog('euchl',options));
 await assert.rejects(()=>validatePortalSeasons('phm',portalSettings({...settings(),seasonIds:[id(99)],defaultSeasonId:id(99)}),options),TypeError);
 const row={organization_id:id(1),season_id:id(11),home_team_id:id(20),home_team_name:'A',away_team_id:id(21),away_team_name:'B',venue_name:'Arena',group_id:id(30),group_name:'Group',phase_id:id(31),phase_name:'Regular season'};
 const directory=await portalDirectory('phm',id(11),{env,loadPortalDirectory:async()=>[row,row]});assert.equal(directory.teams.length,2);assert.equal(directory.venues.length,1);assert.equal(directory.groups[0].phases.length,1);
 for(const patch of [{organization_id:id(2)},{season_id:id(13)}])await assert.rejects(()=>portalDirectory('phm',id(11),{env,loadPortalDirectory:async()=>[{...row,...patch}]}));
 const calls=[],sql={query:async(t,v)=>{calls.push({t,v});return [];}};await portalCatalog('phm',{env,sql});await portalDirectory('phm',id(11),{env,sql});assert.deepEqual(calls[1].v,[id(1),id(11)]);assert.match(calls[1].t,/LIMIT 5001/);
});
test('drafts remain private; protected preview requires exact organization credential',async()=>{
 const {call}=harness();assert.equal((await call('save',{revision:0,config:settings()}, {},'wrong')).code,401);
 assert.equal((await call('save',{revision:0,config:settings()})).code,200);
 for(const action of ['public','data'])assert.equal((await call(action)).code,404);
 assert.equal((await call('preview',null,{},'')).code,401);
 assert.equal((await call('preview',null,{org:'euchl'})).code,401);
 const preview=await call('preview');assert.equal(preview.code,200);assert.equal(preview.body.config.extras,undefined);assert.equal(JSON.stringify(preview.body).includes('privateDraft'),false);
 assert.equal((await call('preview-data',null,{section:'extras'})).body.html,settings().extras);
 assert.equal((await call('save',{revision:1,config:settings()},{},'phm-secret',{origin:'https://other.example'})).code,403);
});
test('dedicated portal credential overrides tools access for PHM without changing EUCHL access',async()=>{
 const {call}=harness({env:{...env,HMS_PHM_PORTAL_ADMIN_SECRET:'dedicated-portal-test'}});
 assert.equal((await call('manage',null,{},'dedicated-portal-test')).code,200);
 assert.equal((await call('manage',null,{},'phm-secret')).code,401);
 assert.equal((await call('manage',null,{org:'euchl'},'dedicated-portal-test')).code,401);
 assert.equal((await call('manage',null,{org:'euchl'},'euchl-secret')).code,200);
});
test('publication freezes settings, rejects stale writers and validates current ownership',async()=>{
 const {call}=harness();await call('save',{revision:0,config:settings()});
 assert.equal((await call('publish',{revision:0})).code,409);assert.equal((await call('publish',{revision:1})).code,200);
 const before=await call('public');assert.equal(before.body.config.title,'PHM Cup');assert.equal(before.body.preview,false);
 assert.equal((await call('save',{revision:2,config:{...settings(),title:'New draft',extras:'unpublished secret'}})).code,200);
 assert.equal((await call('public')).body.config.title,'PHM Cup');assert.equal((await call('data',null,{section:'extras'})).body.html,settings().extras);
 assert.equal((await call('public',null,{seasonId:id(13)})).code,404);
 assert.equal((await call('data',null,{section:'standings'})).code,404);
 assert.equal((await call('save',{revision:3,config:{...settings(),seasonIds:[id(99)],defaultSeasonId:id(99)}})).code,400);
 assert.equal((await call('pause',{revision:3})).code,200);assert.equal((await call('public')).code,404);assert.equal((await call('data',null,{section:'extras'})).code,404);assert.equal((await call('preview')).code,200);
});
test('disabled sections never call their sources and unknown tenants never fall back',async()=>{
 let calls=0;const {call}=harness({portalDirectory:async()=>{calls++;return {teams:[],venues:[],groups:[]};}});await call('save',{revision:0,config:{...settings(),sections:['home']}});await call('publish',{revision:1});
 for(const section of ['teams','extras','games'])assert.equal((await call('data',null,{section})).code,404);assert.equal(calls,0);
 assert.equal((await call('public',null,{org:'unknown'})).code,404);assert.equal((await call('public',null,{org:'euchl'})).code,404);
});
test('shared module links bind the selected season and use the original application routes',()=>{
 const org={slug:'euchl'},season={seasonId:id(11),competitionId:id(10)};
 assert.match(portalModule('games',org,season),new RegExp('^/game-center\\?seasonId='+id(11)));
 assert.match(portalModule('comparison',org,season,'en'),/^\/team-comparison\/euchl\?/);
 assert.equal(new URL(portalModule('rules',org,season)).searchParams.get('seasonId'),id(11));
 const standings=new URL(portalModule('standings',org,season));assert.equal(standings.searchParams.get('competitionIds'),id(10));assert.equal(standings.searchParams.get('seasonId'),id(11));assert.equal(portalModule('home',org,season),null);
});
test('public partner projection respects explicit season and competition bindings',async()=>{
 const data=await portalPartners('phm',{seasonId:id(11),competitionId:id(10)},{env,loadSponsorCatalog:async()=>({teams:[],items:[{id:id(1),name:'Global',secret:'private',scopeRefs:{}},{id:id(2),name:'Current',scopeRefs:{seasonIds:[id(11)]}},{id:id(3),name:'Other',scopeRefs:{seasonIds:[id(13)]}},{id:id(4),name:'Team only',scopeRefs:{teamIds:[id(20)]}},{id:id(5),name:'Other competition',scopeRefs:{competitionIds:[id(12)]}}]})});
 assert.deepEqual(data.items.map(s=>s.name),['Global','Current']);assert.equal(data.items[0].secret,undefined);
});
test('pause uses compare-and-swap and does not touch other tool or organization records',async()=>{
 const calls=[],s=toolStore({tool:'public-portal',sql:{query:async(text,values)=>{calls.push({text,values});return [{draft:settings(),published:null,revision:4}];}}});await s.unpublish('PHM','main',3);assert.deepEqual(calls[0].values,['public-portal','PHM','main',3]);assert.match(calls[0].text,/published=null/);assert.match(calls[0].text,/revision=\$4/);
});
test('published Extras runs in a separate sandboxed document and is revoked with its portal',async()=>{
 const {call}=harness();assert.equal((await call('extras-document')).code,404);
 await call('save',{revision:0,config:settings()});assert.equal((await call('extras-document')).code,404);await call('publish',{revision:1});
 const doc=await call('extras-document');assert.equal(doc.code,200);assert.match(doc.headers['content-security-policy'],/sandbox allow-scripts allow-popups;/);assert.doesNotMatch(doc.headers['content-security-policy'],/allow-same-origin/);assert.match(doc.body,/privateDraft/);
 await call('save',{revision:2,config:{...settings(),sections:['home']}});await call('publish',{revision:3});assert.equal((await call('extras-document')).code,404);
});
test('local and hosting routes share the existing function, preserve protected management and allow only known embed hosts',async()=>{
 const {server}=await import('../src/server.js'),{readFile}=await import('node:fs/promises');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base='http://127.0.0.1:'+server.address().port;for(const path of ['/league/phm','/league/euchl','/control/apps/public-portal']){const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/\/league\/app.js/);assert.match(r.headers.get('content-security-policy'),/frame-src 'self' https:\/\/prod.hms.wootera.net/);}
  for(const path of ['/league/app.css','/league/app.js'])assert.equal((await fetch(base+path)).status,200);
  const r=await fetch(base+'/api/portal?action=public&org=unknown');assert.equal(r.status,404);assert.equal((await fetch(base+'/api/portal?action=manage&org=phm')).status,503);
  const hosting=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));assert.ok(hosting.rewrites.some(r=>r.source==='/api/portal'&&r.destination==='/api/game-summary?view=portal'));assert.ok(hosting.rewrites.some(r=>r.source==='/control/apps/public-portal'));
  for(const h of hosting.headers.filter(h=>h.source==='/game-center'||h.source==='/games/:path*'))assert.match(h.headers.find(h=>h.key==='Content-Security-Policy').value,/frame-ancestors 'self'/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('division membership counts unique teams across matches and phases, retaining multiple real group memberships',async()=>{
 const base={organization_id:id(1),season_id:id(11),home_team_id:id(20),home_team_name:'A',away_team_id:id(21),away_team_name:'B',group_id:id(30),group_name:'Division A',phase_id:id(31),phase_name:'Regular season',group_color:'#ff8800',group_logo_url:'https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/division.png'};
 const rows=[base,{...base,phase_id:id(32),phase_name:'Playoffs'},{...base,group_id:id(40),group_name:'Division B',away_team_id:id(22),away_team_name:'C',group_color:'invalid'}];
 const directory=await portalDirectory('phm',id(11),{env,loadPortalDirectory:async()=>rows});
 assert.equal(directory.teamCount,3);assert.equal(directory.groups[0].teamCount,2);assert.equal(directory.groups[1].teamCount,2);assert.equal(directory.groups[0].phases.length,2);
 assert.equal(directory.groups[0].color,'#ff8800');assert.equal(directory.groups[1].color,null);assert.ok(directory.groups[0].logoUrl);
 const grouped=teamDivisions(directory.teams,directory.groups);assert.equal(grouped.teamCount,3);assert.deepEqual(grouped.divisions.map(g=>g.teamCount),[2,2]);
 assert.deepEqual(directory.teams.find(t=>t.id===id(20)).groupIds,[id(30),id(40)]);
});
test('HMS branding projects only approved media, binds organization and season, and keeps manual season media distinct',async()=>{
 const host='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/',season={seasonId:id(11),competitionId:id(10),sampleGameId:id(100)};
 const org={organizationId:id(1),name:'Organization',logoUrl:host+'organization.png',email:'private@example.test'};
 const game={organizationId:id(1),Season:{seasonId:id(11),logoUrls:{md:host+'season.png'},Competition:{competitionId:id(10),logoUrl:host+'competition.png'}}};
 const opts={env,fetchOrganization:async()=>org,fetchGameDetail:async()=>game};
 const brand=await portalBranding('phm',season,opts);assert.equal(brand.organization.logoUrl,host+'organization.png');assert.equal(brand.season.logoUrl,host+'season.png');assert.equal(brand.competition.logoUrl,host+'competition.png');assert.equal(brand.organization.email,undefined);
 await assert.rejects(()=>portalBranding('phm',season,{...opts,fetchOrganization:async()=>({...org,organizationId:id(2)})}));
 await assert.rejects(()=>portalBranding('phm',season,{...opts,fetchGameDetail:async()=>({...game,Season:{...game.Season,seasonId:id(99)}})}));
 const unsafe=await portalBranding('phm',season,{...opts,fetchOrganization:async()=>({...org,logoUrl:'https://other.example/track.png'})});assert.equal(unsafe.organization.logoUrl,null);
 const media=seasonMedia({...season,seasonId:id(12),seasonLogoUrl:host+'other-season.png'},season,brand);assert.equal(media.seasonLogoUrl,host+'other-season.png');assert.equal(media.competitionLogoUrl,host+'competition.png');
});
test('selected portal colors preserve readable foregrounds and embedded reports open outside the frame on the portal host',()=>{
 assert.equal(themeVariables('#ffff00')['--portal-on-accent'],'#13243c');assert.equal(themeVariables('#002244')['--portal-on-accent'],'#ffffff');assert.equal(themeVariables('red;display:none')['--portal-accent'],'#087b91');
 const embedded=gameReportNavigation(id(100),'en',true);assert.equal(embedded.target,'_blank');assert.equal(new URL(embedded.href,'https://public.heromanagementsystem.com').hostname,'public.heromanagementsystem.com');
 const standalone=gameReportNavigation(id(100),'cs');assert.equal(standalone.target,null);assert.equal(new URL(standalone.href).hostname,'app.phmcup.cz');assert.throws(()=>gameReportNavigation('invalid','cs',true));
 assert.match(portalModule('games',{slug:'phm'},{seasonId:id(11),competitionId:id(10)}),/embed=1/);
});

test('public team directory refreshes obsolete logos from the live organization catalog without changing divisions',async()=>{
 const host='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/';
 const team={id:id(20),name:'Guardians',logoUrl:host+'obsolete.png',groupIds:[id(30)]};
 const {call}=harness({portalDirectory:async()=>({teams:[team],groups:[{id:id(30),teamIds:[id(20)]}],teamCount:1}),portalPartners:async()=>({teams:[{id:id(20),logoUrl:host+'current.png'},{id:id(99),logoUrl:host+'unrelated.png'}]})});
 await call('save',{revision:0,config:settings()});await call('publish',{revision:1});
 const result=await call('data',null,{section:'teams'});
 assert.equal(result.code,200);assert.equal(result.body.teams[0].logoUrl,host+'current.png');assert.deepEqual(result.body.teams[0].groupIds,[id(30)]);assert.equal(result.body.teams.length,1);
});
