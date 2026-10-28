import test from 'node:test';
import assert from 'node:assert/strict';
import {sponsorLogo,sponsorSearch,hmsSponsorImage} from '../public/sponsors/model.js';
import {sponsorCatalog} from '../src/app/sponsors.js';
import {createSponsorsHandler} from '../src/web/sponsors-handler.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const root='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/';
test('sponsor logo preserves explicit original and all safe API variants; cropped-only URLs are never relabeled originals',()=>{
 const logo=sponsorLogo({logoUrls:{md:root+'cropped_md',original:root+'actual-source.png'},crop:{x:4,y:5,width:200,height:200,secret:'hidden'}});
 assert.equal(logo.originalUrl,root+'actual-source.png');assert.equal(logo.displayUrl,logo.originalUrl);assert.equal(logo.overrideUrl,null);assert.deepEqual(logo.crop,{x:4,y:5,width:200,height:200});
 const cropped=sponsorLogo({logoUrls:{md:root+'cropped_md',sm:root+'cropped_sm'}});assert.equal(cropped.originalUrl,null);assert.equal(cropped.displayUrl,root+'cropped_md');
 for(const value of ['https://localhost/x','https://127.0.0.1/x','https://prod-hms-wootera.s3.eu-central-1.amazonaws.com:8443/x',root+'x?token=hidden','https://evil.test/x'])assert.equal(hmsSponsorImage(value),null);
});
test('one catalog projects safe public sponsor data and relations, excludes disabled records and searches accented labels',()=>{
 const value=sponsorCatalog([{sponsorId:id(2),name:'Černý Orel',nick:'Orel',short:'RČO',active:true,teamIds:[id(3)],competitionIds:[id(4)],logoUrls:{original:root+'orel.png'},email:'private',legalName:'private'},{sponsorId:id(5),name:'Disabled',isActive:false}],[],{code:'EUCHL',id:id(1)});
 assert.equal(value.items.length,1);assert.deepEqual(value.items[0].teams,[id(3)]);assert.deepEqual(value.items[0].competitions,[id(4)]);assert.equal(sponsorSearch(value.items,'cerny')[0].name,'Černý Orel');assert.equal(sponsorSearch(value.items,'rco').length,1);assert.doesNotMatch(JSON.stringify(value),/private/);
});
test('shared endpoint is read-only, organization-scoped and never returns internal errors or tokens',async()=>{
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 const env={HMS_EUCHL_ORGANIZATION_ID:id(1),HMS_EUCHL_API_TOKEN:'PRIVATE',HMS_API_TOKEN:'PHM-PRIVATE'};
 let selected;const handler=createSponsorsHandler({env,loadSponsors:async org=>{selected=org;return {org:org.code,items:[]};}});
 let res=response();await handler({method:'GET',query:{org:'EUCHL'}},res);assert.equal(res.code,200);assert.equal(selected.token,'PRIVATE');assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE/);
 res=response();await handler({method:'POST',query:{org:'EUCHL'}},res);assert.equal(res.code,405);
 res=response();await handler({method:'GET',query:{org:'unknown'}},res);assert.equal(res.code,400);
});
