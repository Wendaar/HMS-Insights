import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchVenues} from '../src/hms/client.js';
import {venueCatalog,loadVenueCatalog,applyVenueCatalog} from '../src/app/venues.js';
import {mediaGame} from '../src/app/media-engine.js';
import {createStudioHandler} from '../src/web/studio-handler.js';
import {gameEventsResponse,lineupResponse,ids} from '../src/fixtures/real-game-sanitized.js';
const venueId='88888888-1111-4111-8111-111111111111',otherId='99999999-1111-4111-8111-111111111111';
const logo='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/spm-logo.png',background='https://cdn.example.com/arena.jpg';
const org={code:'PHM',id:ids.org,token:'test-only'};
const rows=()=>[{venueId,name:'SPM Aréna',logoUrls:{md:logo,sm:null},backgroundImageUrl:background,privateNote:'PRIVATE_VALUE_SENTINEL'}];
test('documented Venues transport uses GET and comma-separated ids with server-only bearer auth',async()=>{
 let request;const result=await fetchVenues({ids:venueId},{config:{token:'test-only',baseUrl:'https://public-api.prod.hms.wootera.net/api/v1'},fetchImpl:async(url,opts)=>{request={url,opts};return Response.json(rows());}});
 assert.equal(request.url.pathname,'/api/v1/venues');assert.equal(request.url.searchParams.get('ids'),venueId);assert.equal(request.opts.headers.authorization,'Bearer test-only');assert.equal(request.opts.method,undefined);assert.equal(result[0].venueId,venueId);
});
test('venue catalog projects media availability and ignores raw private metadata values',()=>{
 const result=venueCatalog(rows(),org);assert.equal(result.items[0].logoUrl,logo);assert.equal(result.items[0].backgroundSourceUrl,background);assert.deepEqual(result.items[0].availability,{logo:'available',background:'available'});assert.doesNotMatch(JSON.stringify(result),/PRIVATE_VALUE_SENTINEL/);
 const empty=venueCatalog([{venueId,name:'Empty',logoUrls:{md:null}}],org).items[0];assert.equal(empty.availability.logo,'empty');assert.equal(empty.availability.background,'not-exposed');
 const blank=venueCatalog([{venueId,name:'Blank',backgroundImageUrl:null}],org).items[0];assert.equal(blank.availability.background,'empty');
 const editor=venueCatalog([{venueId,name:'Editor field',igBgImageUrl:'https://www.flickr.com/photos/153512269@N03/54170419316/in/dateposted/'}],org).items[0];assert.equal(editor.backgroundField,'igBgImageUrl');assert.equal(editor.availability.background,'available');assert.equal(editor.backgroundSourceUrl,'https://www.flickr.com/photos/153512269@N03/54170419316/');
 const unknown=venueCatalog([{venueId,name:'Unknown schema',customBackgroundField:background}],org).items[0];assert.equal(unknown.availability.background,'unsupported');assert.equal(unknown.backgroundSourceUrl,null);
 for(const bad of [[...rows(),...rows()],[{...rows()[0],organizationId:otherId}],[{...rows()[0],venueId:'invalid'}]])assert.throws(()=>venueCatalog(bad,org));
 assert.throws(()=>venueCatalog(rows(),org,{ids:[otherId]}));
});
test('venue reader verifies token organization first and requests only the exact venue ID',async()=>{
 let supplied;const result=await loadVenueCatalog(org,{ids:[venueId],fetchOrganization:async()=>({organizationId:ids.org}),fetchVenues:async(params,{config})=>{supplied={params,config};return rows();}});
 assert.equal(result.org,'PHM');assert.deepEqual(supplied.params,{ids:venueId});assert.equal(supplied.config.token,'test-only');assert.equal(result.token,undefined);
 let called=false;await assert.rejects(loadVenueCatalog(org,{fetchOrganization:async()=>({organizationId:otherId}),fetchVenues:async()=>{called=true;return rows();}}));assert.equal(called,false);
 await assert.rejects(loadVenueCatalog(org,{ids:['bad']}),TypeError);
});
test('venue catalog media joins by ID and organization, preserving existing match-specific media',()=>{
 const catalog=venueCatalog(rows(),org),base={org:'PHM',venueId,venue:'SPM Aréna'};
 assert.equal(applyVenueCatalog({...base},catalog).venueLogoUrl,logo);assert.equal(applyVenueCatalog({...base,venueId:otherId},catalog).venueLogoUrl,undefined);assert.equal(applyVenueCatalog({...base,org:'EUCHL'},catalog).venueLogoUrl,undefined);
 assert.equal(applyVenueCatalog({...base,venueLogoUrl:'existing'},catalog).venueLogoUrl,'existing');
});
test('shared media engine fills missing venue images from the separately scoped catalog',async()=>{
 const detail={...gameEventsResponse,status:'NOT PLAYED',Venue:{venueId,name:'SPM Aréna'}};let selectedIds;
 const result=await mediaGame('PHM',ids.game,{env:{HMS_API_TOKEN:'test-only',HMS_PHM_ORGANIZATION_ID:ids.org},refresh:true,fetchResponses:async()=>[detail,detail,lineupResponse,null],fetchMetadata:async()=>null,fetchOrganization:async()=>({organizationId:ids.org}),fetchBrandingDetail:async()=>({}),loadVenues:async(config,options)=>{selectedIds=options.ids;return venueCatalog(rows(),config);}});
 assert.deepEqual(selectedIds,[venueId]);assert.equal(result.venueLogoUrl,logo);assert.equal(result.venueBackgroundUrl,background);assert.equal(result.organizationId,undefined);
});
test('Studio venue check exposes safe sporting projection only and keeps read-only/error boundaries',async()=>{
 const handler=createStudioHandler({loadVenues:async()=>venueCatalog(rows(),org)}),run=async(method='GET',selected='PHM')=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;}};await handler({method,query:{catalog:'venues',org:selected}},res);return res;};
 assert.equal((await run()).code,200);assert.equal((await run('POST')).code,405);assert.equal((await run('GET','unknown')).code,400);
 const res=await run();assert.equal(res.headers['Cache-Control'],'no-store');assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_VALUE_SENTINEL|Bearer test-only/);
});
