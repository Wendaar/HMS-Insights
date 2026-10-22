import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicFeedHandler,publicFeedOrganization} from '../src/web/public-feed-handler.js';
import {PHM_ORGANIZATION_ID} from '../src/app/organizations.js';
const other='11111111-1111-1111-1111-111111111111';
const env={HMS_EUCHL_ORGANIZATION_ID:other,HMS_API_TOKEN:'PRIVATE_SENTINEL',HMS_WEBHOOK_SECRET:'PRIVATE_SENTINEL'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(code){this.code=code;return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;}});
const fixture=org=>({id:org+'-moment',type:'HATTRICK',title:'Hattrick '+org,text:'Výkon '+org,player:'Hráč '+org,team:org+' Home',homeTeam:org+' Home',awayTeam:org+' Away',homeScore:3,awayScore:1,gameId:'22222222-2222-2222-2222-222222222222',date:'2026-10-22',importance:95,group:org+' group',season:'2026/2027',facts:{goals:3}});
function loaders(calls){
 const read=async p=>{calls.push(p);const code=p.organizationId===PHM_ORGANIZATION_ID?'PHM':'EUCHL';return {items:[fixture(code)],total:1,offset:Number(p.offset??0),hasMore:false};};
 return {loadSelection:read,loadPage:read,loadOptions:async p=>{calls.push(p);return {groups:[p.organizationId===PHM_ORGANIZATION_ID?'PHM group':'EUCHL group']};}};
}
test('legacy PHM page paths cannot be switched by org/feedOrg query parameters; deep links own org',()=>{
 for(const path of ['/','/priklepy','/archiv','/priklepy/'])assert.equal(publicFeedOrganization({url:path+'?org=EUCHL&feedOrg=EUCHL',query:{org:'EUCHL',feedOrg:'EUCHL'}},{html:true,env}).code,'PHM');
 for(const path of ['/priklepy/euchl','/archiv/EUCHL/'])assert.equal(publicFeedOrganization({url:path,query:{org:'PHM',feedOrg:'PHM'}},{html:true,env}).code,'EUCHL');
 assert.equal(publicFeedOrganization({url:'/api/page?feedOrg=euchl',query:{feedOrg:'euchl'}},{html:true,env}).code,'EUCHL');
 assert.equal(publicFeedOrganization({query:{}},{env}).code,'PHM');
 assert.throws(()=>publicFeedOrganization({url:'/archiv/unknown',query:{feedOrg:'PHM'}},{html:true,env}));
});
test('selection and archive HTML, navigation, metadata and all option loaders stay in their org',async()=>{
 for(const mode of ['selection','archive'])for(const code of ['PHM','EUCHL']){
  const calls=[],res=response(),path=mode==='selection'?'/priklepy':'/archiv';
  await createPublicFeedHandler({html:true,mode,env,...loaders(calls)})({method:'GET',url:code==='PHM'?path:path+'/euchl',query:{}},res);
  assert.equal(res.code,200);assert.ok(calls.every(p=>p.organizationId===(code==='PHM'?PHM_ORGANIZATION_ID:other)));
  assert.match(res.body,new RegExp(code+' Home'));assert.doesNotMatch(res.body,new RegExp((code==='PHM'?'EUCHL':'PHM')+' Home'));assert.doesNotMatch(res.body,/PRIVATE_SENTINEL|11111111-1111/);
  assert.match(res.body,new RegExp('"organization":"'+code+'"'));assert.match(res.body,/src="\/app.js/);assert.match(res.body,/href="\/styles.css/);
  if(code==='EUCHL'){assert.match(res.body,/href="\/priklepy\/euchl"/);if(mode==='archive')assert.match(res.body,/href="\/archiv\/euchl"/);}else assert.doesNotMatch(res.body,/href="\/(priklepy|archiv)\/euchl"/);
 }
});
test('selection search and archive paging/counts/filter queries always carry org UUID and return canonical org code',async()=>{
 for(const mode of ['selection','archive'])for(const code of ['PHM','EUCHL']){
  const calls=[],res=response();await createPublicFeedHandler({mode,env,...loaders(calls)})({method:'GET',query:{org:code,q:'same player',group:'same group',team:'same team',season:'2026/2027',offset:'40',limit:'20'}},res);
  assert.equal(res.code,200);assert.equal(res.body.organization,code);assert.equal(calls[0].organizationId,code==='PHM'?PHM_ORGANIZATION_ID:other);assert.equal(calls[0].query,'same player');assert.equal(calls[0].group,'same group');assert.equal(calls[0].team,'same team');
  if(mode==='archive'){assert.equal(calls[0].offset,'40');assert.equal(calls[0].season,'2026/2027');}assert.ok(res.body.items.every(i=>i.homeTeam===code+' Home'));assert.match(res.body.html,new RegExp(code+' Home'));
  assert.equal(res.headers['cache-control'],'no-store');assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_SENTINEL/);
 }
});
test('unknown/unconfigured orgs never run a PHM loader; errors are generic and uncached',async()=>{
 for(const [org,status] of [['unknown',404],['YHG',503],[['PHM','EUCHL'],404]]){
  let loaded=false;const res=response();await createPublicFeedHandler({env,loadSelection:async()=>{loaded=true;}})({method:'GET',query:{org}},res);assert.equal(res.code,status);assert.equal(loaded,false);assert.equal(res.headers['cache-control'],'no-store');
 }
 const res=response();await createPublicFeedHandler({env,loadSelection:async()=>{throw new Error('PRIVATE_SENTINEL');}})({method:'GET',query:{}},res);assert.equal(res.code,503);assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_SENTINEL/);
 const post=response();await createPublicFeedHandler({env})({method:'POST',query:{org:'EUCHL'}},post);assert.equal(post.code,405);
});
