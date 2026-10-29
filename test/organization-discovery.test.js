import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOrganizations,normalizeOrganizationCatalog,loadOrganizationCatalog,organizationFromCatalog} from '../public/organization-catalog.js';
import {organizationConfig,publicOrganizations} from '../src/app/organizations.js';
import {setOrganizationCatalog,appsForOrganization} from '../public/control/registry.js';
import {mapForOrganization,nodeUrl} from '../public/control/map.js';
import {setBroadcastOrganizations,parseGameInput,organizationCatalog} from '../public/broadcast/hms-source.js';
import {channelState} from '../src/web/broadcast-channel.js';
import {broadcastLibrary} from '../src/domain/broadcast-library.js';
import {createBroadcastHandler} from '../src/web/broadcast-handler.js';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const env={HMS_API_TOKEN:'PHM-PRIVATE',HMS_WEBHOOK_SECRET:'PHM-SECRET',HMS_STUDIO_ORGANIZATIONS:JSON.stringify([{code:'CUSTOM',slug:'new-league',name:'New League'}])};
for(const [n,code] of ['YHG','FLLH','POLICE','CUSTOM'].entries()){env[`HMS_${code}_ORGANIZATION_ID`]=id(n+1);env[`HMS_${code}_API_TOKEN`]=code+'-PRIVATE';}
const state={org:'POLICE',gameId:id(20),lang:'en',layer:'opening',side:'home',period:'current',page:1,insight:'',visible:false};

test('one registry discovers FLLH, YHG, POLICE and future organizations without exposing credentials',async()=>{
 const rows=publicOrganizations(env);for(const code of ['FLLH','YHG','POLICE','CUSTOM'])assert.equal(rows.find(o=>o.code===code).configured,true);
 assert.equal(organizationConfig('fllh',env).token,'FLLH-PRIVATE');assert.equal(organizationConfig('police',env).id,id(3));
 assert.equal(organizationFromCatalog(rows,'new-league').code,'CUSTOM');
 const result=await loadOrganizationCatalog({fetchImpl:async(url,options)=>{assert.equal(url,'/api/studio?catalog=1');assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({organizations:rows.map(o=>({...o,token:'must-not-survive'}))})};}});
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|SECRET|must-not-survive|ORGANIZATION_ID/);
 assert.ok(result.every(o=>Object.keys(o).sort().join(',')==='code,configured,name,slug'));
});
test('configured organizations acquire their own generic tool links while unconnected and legacy tools stay unavailable',()=>{
 try{
  const rows=publicOrganizations(env);setOrganizationCatalog(rows);
  for(const slug of ['fllh','yhg','police','new-league']){
   const apps=appsForOrganization(slug),studio=apps.find(a=>a.id==='studio');assert.equal(studio.links.open,`/studio/${slug}?lang=cs`);
   assert.equal(new URL(apps.find(a=>a.id==='insights-public').links.public).pathname,`/priklepy/${slug}`);
   assert.equal(apps.find(a=>a.id==='playoff-players').status,'prepared');
   const node=mapForOrganization(slug).flatMap(b=>b.nodes).find(n=>n.id==='obs-output');
   assert.equal(new URL(nodeUrl(node,slug,{gameId:id(20)})).searchParams.get('org'),slug==='new-league'?'CUSTOM':slug.toUpperCase());
  }
  setOrganizationCatalog(publicOrganizations({HMS_API_TOKEN:'PHM-PRIVATE'}));
  for(const slug of ['fllh','yhg','police'])assert.ok(appsForOrganization(slug).every(a=>a.status==='prepared'&&!Object.keys(a.links).length));
 }finally{setOrganizationCatalog(defaultOrganizations.map(o=>({...o,configured:['PHM','EUCHL'].includes(o.code)})));}
});
test('OBS parses organization slugs and accepts only registered scoped configurations for channels and assets',()=>{
 try{
  setBroadcastOrganizations(publicOrganizations(env));
  assert.equal(parseGameInput(`https://prod.hms.wootera.net/org/police/games/${id(20)}`).org,'POLICE');
  assert.equal(parseGameInput(`https://prod.hms.wootera.net/org/new-league/games/${id(20)}`).org,'CUSTOM');
  for(const code of ['YHG','FLLH','POLICE','CUSTOM'])assert.equal(channelState({...state,org:code},env).org,code);
  assert.throws(()=>channelState(state,{HMS_API_TOKEN:'PHM-PRIVATE'}));
  assert.throws(()=>channelState({...state,org:'UNKNOWN'},env));
  const ref={id:id(21),kind:'hms-sponsor',org:'CUSTOM',scope:'team',targetId:id(22),sponsorId:id(23),enabled:true};
  assert.equal(broadcastLibrary([ref],env)[0].org,'CUSTOM');assert.throws(()=>broadcastLibrary([ref],{}));
  assert.throws(()=>parseGameInput(`https://prod.hms.wootera.net/org/unknown/games/${id(20)}`));
 }finally{setBroadcastOrganizations(defaultOrganizations);}
});
test('new organization broadcast requests never borrow the PHM configuration',async()=>{
 const calls=[],handler=createBroadcastHandler({env,browse:async(query,options)=>{calls.push(organizationConfig(query.org,options.env));return {items:[]};}});
 const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 for(const code of ['YHG','FLLH','POLICE','CUSTOM']){const r=res();await handler({method:'GET',headers:{},query:{org:code}},r);assert.equal(r.code,200);assert.equal(r.body.org,code);assert.equal(calls.at(-1).token,code+'-PRIVATE');}
 const r=res();await handler({method:'GET',headers:{},query:{org:'unknown'}},r);assert.notEqual(r.code,200);assert.equal(calls.length,4);
});
test('failed or ambiguous organization discovery cannot fall back to PHM',async()=>{
 await assert.rejects(loadOrganizationCatalog({fetchImpl:async()=>({ok:false})}));
 for(const rows of [[],null,[{code:'EVIL',slug:'../phm',name:'Bad'}],[...defaultOrganizations,defaultOrganizations[0]]])assert.throws(()=>normalizeOrganizationCatalog(rows));
 assert.equal(organizationFromCatalog(defaultOrganizations,'unknown'),null);
});
