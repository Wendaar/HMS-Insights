import test from 'node:test';
import assert from 'node:assert/strict';
import {graphicSettings,formats,candidatePage} from '../public/all-stars/presentation.js';
import {allStarsSettings} from '../src/app/all-stars.js';
test('candidate paging applies named team/search filters before the bounded window',()=>{
 const candidates=Array.from({length:65},(_,i)=>({id:String(i),teamId:i<45?'a':'b',name:`Hráč ${i}`,team:i<45?'Praha':'Brno'}));
 let page=candidatePage(candidates);assert.equal(page.items.length,20);assert.equal(page.total,65);assert.equal(page.hasMore,true);
 page=candidatePage(candidates,{limit:40});assert.equal(page.items.length,40);assert.equal(page.items[20].id,'20');
 page=candidatePage(candidates,{team:'b',search:'hrac'});assert.equal(page.items.length,20);assert.equal(page.total,20);assert.equal(page.hasMore,false);
 assert.equal(candidatePage(candidates,{search:'BRNO'}).total,20);assert.equal(candidatePage(candidates,{limit:-1}).items.length,20);
});
test('graphics validate known Studio fonts, styles, five pixel formats and two All Stars compositions',()=>{
 assert.deepEqual(formats['16:9'],[1920,1080]);assert.deepEqual(formats['16:10'],[1600,1000]);assert.deepEqual(formats['9:16'],[1080,1920]);
 for(const format of Object.keys(formats))assert.equal(graphicSettings({format}).format,format);
 const value=graphicSettings({format:'9:16',design:'technical',template:'cards',font:'Frontline',url:'https://untrusted.test'});
 assert.deepEqual(value,{format:'9:16',design:'technical',template:'cards',font:'Frontline'});
 assert.deepEqual(graphicSettings({format:'invalid',design:'invalid',template:'invalid',font:'invalid'}),graphicSettings());
 const config={title:'Test',seasonId:'11111111-1111-4111-8111-111111111111',groupId:'22222222-2222-4222-8222-222222222222',month:'2026-09',selection:{F:[],D:[],G:[]},graphics:value};
 assert.deepEqual(allStarsSettings(config).graphics,value);assert.deepEqual(allStarsSettings({...config,graphics:undefined}).graphics,graphicSettings());
});
