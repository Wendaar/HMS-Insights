import test from 'node:test';
import assert from 'node:assert/strict';
import {sponsorCatalog,loadSponsorCatalog} from '../src/app/broadcast-sponsors.js';
import {fetchSponsors,fetchTeams} from '../src/hms/client.js';
import {createBroadcastHandler} from '../src/web/broadcast-handler.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,org={code:'EUCHL',id:id(1),token:'euchl-private'};
const sponsors=[{sponsorId:id(2),name:'Partner A',claim:'A claim',web:'https://example.com',logoUrl:'https://evil.test/logo.png',legalName:'private legal details',email:'private@example.com'},{sponsorId:id(3),name:'Partner B'}];
test('catalog supports multiple sponsors per team, multiple teams per sponsor, deduplicates links and projects only public fields',()=>{
  const value=sponsorCatalog([{...sponsors[0],Teams:[{teamId:id(4)}]},sponsors[1]],[{teamId:id(4),name:'Home',Sponsors:[{sponsorId:id(2)},{sponsorId:id(3)},{sponsorId:id(99)}],email:'private@team'},{teamId:id(5),name:'Away',Sponsors:[{Sponsor:{sponsorId:id(2)}}]}],org);
  assert.equal(value.bindings.length,3);assert.equal(value.items[0].claim,'A claim');assert.equal(value.items[0].logoUrl,null);assert.equal(value.relationshipStatus,'returned-links');assert.doesNotMatch(JSON.stringify(value),/private@example|private@team|private legal|euchl-private/);
});
test('empty sponsors and absent relationship arrays never invent links or imply all HMS team associations are absent',()=>{
  const value=sponsorCatalog(sponsors,[{teamId:id(4),name:'Home'}],org);assert.deepEqual(value.bindings,[]);assert.equal(value.relationshipStatus,'no-links-returned');
  assert.equal(sponsorCatalog([],[],org).items.length,0);assert.equal(sponsorCatalog(sponsors,null,org).relationshipStatus,'teams-unavailable');
  assert.throws(()=>sponsorCatalog({...sponsors},[],org));assert.throws(()=>sponsorCatalog([{...sponsors[0],organizationId:id(99)}],[],org));
});
test('catalog verifies token organization, keeps read calls independently scoped, and tolerates only an unavailable teams collection',async()=>{
  const calls=[],opts={env:{},fetchOrganization:async({config})=>{calls.push(config.token);return {organizationId:org.id};},fetchSponsors:async({config})=>{assert.equal(config.timeoutMs,5000);calls.push(config.token);return sponsors;},fetchTeams:async({config})=>{calls.push(config.token);throw new Error('teams offline');}};
  const value=await loadSponsorCatalog(org,opts);assert.deepEqual(calls,['euchl-private','euchl-private','euchl-private']);assert.equal(value.items.length,2);assert.equal(value.teamsAvailable,false);
  await assert.rejects(loadSponsorCatalog(org,{...opts,fetchOrganization:async()=>({organizationId:id(99)})}),/mismatch/);
  await assert.rejects(loadSponsorCatalog(org,{...opts,fetchSponsors:async()=>{throw new Error('sponsors offline');}}),/sponsors offline/);
});
test('HMS sponsor and team adapters use authenticated GETs without copying credentials into their URLs',async()=>{
  const urls=[];const opts={config:{token:org.token,baseUrl:'https://public-api.prod.hms.wootera.net/api/v1'},fetchImpl:async(url,init)=>{urls.push(String(url));assert.equal(init.headers.authorization,'Bearer '+org.token);assert.equal(init.body,undefined);return {ok:true,json:async()=>[]};}};
  await fetchSponsors(opts);await fetchTeams(opts);assert.deepEqual(urls,['https://public-api.prod.hms.wootera.net/api/v1/sponsors','https://public-api.prod.hms.wootera.net/api/v1/teams']);
});
test('broadcast routes catalog reads independently of games and never borrows PHM credentials',async()=>{
  const handler=createBroadcastHandler({env:{HMS_EUCHL_ORGANIZATION_ID:org.id,HMS_EUCHL_API_TOKEN:org.token,HMS_API_TOKEN:'phm-private'},loadSponsors:async selected=>{assert.equal(selected.token,org.token);return {org:selected.code,items:[]};},fetchDetail:async()=>{throw new Error('must not load game');}});
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
  await handler({method:'GET',headers:{},query:{org:'EUCHL',catalog:'sponsors'}},res);assert.equal(res.code,200);assert.deepEqual(res.body,{org:'EUCHL',items:[]});
});
