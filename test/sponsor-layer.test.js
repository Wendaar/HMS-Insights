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

import {sponsorFrame,normalizeRotation} from '../public/sponsors/rotation.js';
import {resolvePartnerFrame,renderExtraLayer} from '../public/broadcast/extra-layers.js';
import {broadcastLibrary} from '../src/domain/broadcast-library.js';
import {channelState} from '../src/web/broadcast-channel.js';
import {viewUrl} from '../public/broadcast/hms-source.js';
test('rotation has real blank intervals, per-item timing, precise boundaries, looping and 400ms fades',()=>{
 const items=[{id:'A'},{id:'B'},{id:'C',pauseSeconds:120}],r={enabled:true,showSeconds:15,pauseSeconds:30,startedAt:1000};
 const at=t=>sponsorFrame(items,r,1000+t);
 assert.equal(at(1000).item.id,'A');assert.equal(at(0).opacity,0);assert.equal(at(200).opacity,.5);assert.equal(at(14900).opacity,.25);
 for(const t of [15000,30000,44999,60000,80000,105000,220000])assert.equal(at(t).phase,'blank',String(t));
 assert.equal(at(45000).item.id,'B');assert.equal(at(90000).item.id,'C');assert.equal(at(225000).item.id,'A');assert.equal(at(226000).opacity,1);
 assert.equal(sponsorFrame([],r,1000).item,null);assert.equal(sponsorFrame(items,{...r,enabled:false},9999999).item.id,'A');
 assert.equal(sponsorFrame([{id:'A',showSeconds:2,pauseSeconds:0},{id:'B'}],r,3500).item.id,'B');
});
test('timing/reference transport preserves explicit choices and overrides and rejects bad values',()=>{
 const r={enabled:true,showSeconds:15,pauseSeconds:30,startedAt:12345};
 assert.deepEqual(normalizeRotation(r),r);
 for(const value of [{...r,showSeconds:0},{...r,pauseSeconds:-1},{...r,pauseSeconds:3601},{...r,startedAt:NaN}])assert.throws(()=>normalizeRotation(value));
 const ref={id:id(3),kind:'hms-sponsor',org:'EUCHL',scope:'game',targetId:id(4),sponsorId:id(5),enabled:true,showSeconds:15,pauseSeconds:120,overrideUrl:'https://example.com/full.png'};
 assert.deepEqual(broadcastLibrary([ref]),[ref]);assert.throws(()=>broadcastLibrary([{...ref,pauseSeconds:99999}]));assert.throws(()=>broadcastLibrary([{...ref,overrideUrl:'https://127.0.0.1/x'}]));
 const state={org:'EUCHL',gameId:id(4),lang:'cs',layer:'sponsors',side:'home',period:'current',page:1,insight:'',visible:true,sponsorRotation:r};
 assert.deepEqual(channelState(state,{HMS_EUCHL_ORGANIZATION_ID:id(1),HMS_EUCHL_API_TOKEN:'private'}).sponsorRotation,r);
 const url=new URL(viewUrl('https://example.com/broadcast/index.html',{...state,gameId:id(4)}));assert.equal(url.searchParams.get('sponsorPause'),'30');assert.equal(url.searchParams.get('sponsorStart'),'12345');
});
test('new playlist requires explicit selection; all-off and other-org catalogs are transparent',()=>{
 const game={ID:id(4),homeId:id(7),awayId:id(8),'Home Team':'A','Away Team':'B'},catalog={org:'EUCHL',items:[{id:id(5),name:'Orel',logo:{originalUrl:root+'orel-full.png'}}],bindings:[]};
 const settings={org:'EUCHL',layer:'sponsors',partnerSource:'hms',partnerScope:'organization',sponsorCatalog:catalog,sponsorRotation:{enabled:true,showSeconds:15,pauseSeconds:30,startedAt:0}};
 assert.equal(renderExtraLayer(game,settings),'');
 const ref={id:id(3),kind:'hms-sponsor',org:'EUCHL',scope:'game',targetId:game.ID,sponsorId:id(5),enabled:true};
 assert.match(renderExtraLayer(game,{...settings,partnerFrame:resolvePartnerFrame(game,{...settings,items:[ref]},1000)}),/orel-full.png/);
 assert.equal(renderExtraLayer(game,{...settings,items:[{...ref,enabled:false}]}),'');
 assert.equal(renderExtraLayer(game,{...settings,sponsorCatalog:{...catalog,org:'PHM'},items:[ref]}),'');
});

import {verifiedSponsorLogo} from '../src/app/sponsor-logo-overrides.js';
test('Cerny Orel fallback is the verified full official logo, scoped to exact org/UUID/site, never masquerading as HMS original',()=>{
 const record={id:'900a2f40-d000-11f1-837b-27c5e6cdebf9',website:'https://www.restauracecernyorel.cz/'},cropped={originalUrl:null,displayUrl:root+'cropped_md',overrideUrl:null};
 const result=verifiedSponsorLogo({code:'EUCHL'},record,cropped);assert.match(result.overrideUrl,/restaurace-cerny-orel.png$/);assert.equal(result.originalUrl,null);assert.equal(result.overrideSource.kind,'official-website');
 for(const [org,sponsor] of [[{code:'PHM'},record],[{code:'EUCHL'},{...record,id:id(3)}],[{code:'EUCHL'},{...record,website:'https://example.com'}]])assert.equal(verifiedSponsorLogo(org,sponsor,cropped).overrideUrl,null);
 const original={...cropped,originalUrl:root+'real-original.png'};assert.equal(verifiedSponsorLogo({code:'EUCHL'},record,original),original);
});

import {saveSponsorOverride,withSponsorOverrides,localSponsorAsset,sponsorDisplayLogo} from '../public/sponsors/model.js';
import {saveSponsorPreferences,readSponsorPreferences} from '../public/sponsors/rotation.js';
test('local overrides and rotation defaults remain independent even for identical sponsor UUIDs in different orgs',()=>{
 const previous=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 try{
  saveSponsorOverride('PHM',id(3),'https://example.com/phm.png');saveSponsorOverride('EUCHL',id(3),'https://example.com/euchl.png');
  for(const org of ['PHM','EUCHL'])assert.equal(withSponsorOverrides({org,items:[{id:id(3),logo:{}}]}).items[0].logo.overrideUrl,'https://example.com/'+org.toLowerCase()+'.png');
  saveSponsorPreferences('PHM','organization','',{choices:[],rotation:{showSeconds:10,pauseSeconds:120}});
  saveSponsorPreferences('EUCHL','organization','',{choices:[],rotation:{showSeconds:15,pauseSeconds:30}});
  assert.equal(readSponsorPreferences('PHM').rotation.pauseSeconds,120);assert.equal(readSponsorPreferences('EUCHL').rotation.pauseSeconds,30);
  saveSponsorOverride('EUCHL',id(3),'');assert.equal(withSponsorOverrides({org:'EUCHL',items:[{id:id(3),logo:{overrideUrl:'https://example.com/default.png'}}]}).items[0].logo.overrideUrl,'https://example.com/default.png');
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('bundled sponsor override stays same-origin on preview/aliases, without admitting arbitrary local URLs',()=>{
 const previous=globalThis.location;globalThis.location={origin:'http://127.0.0.1:1234'};
 try{
  const path='/sponsors/logos/restaurace-cerny-orel.png',url=sponsorDisplayLogo({logo:{overrideUrl:'https://app.phmcup.cz'+path}});
  assert.equal(url,'http://127.0.0.1:1234'+path);assert.equal(localSponsorAsset(url),true);assert.equal(localSponsorAsset('http://127.0.0.1:1234/private'),false);assert.equal(localSponsorAsset(url+'?secret=x'),false);
 }finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
});
