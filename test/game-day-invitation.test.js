import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDate,invitationText,gameDayText,shareInvitation} from '../public/studio/game-day-invitation.js';
const fixture={org:'PHM',date:'2026-11-01',time:'20:00',venue:'SPM Aréna',competition:'PHM Cup',home:{name:'H.O.V.N.A.'},away:{name:'Prague Pigeons'},links:{game:'https://app.phmcup.cz/game-center/example'}};
test('invitation includes localized calendar day, time, venue, both teams and roster instructions',()=>{
 assert.equal(fixtureDate(fixture.date).day,'neděle');assert.equal(fixtureDate(fixture.date,true).day,'Sunday');
 for(const en of [false,true]){const text=invitationText(fixture,{en});for(const value of ['20:00','SPM Aréna','PHM Cup','H.O.V.N.A.','Prague Pigeons','https://prod.hms.wootera.net/'])assert.ok(text.includes(value));}
 assert.equal(invitationText(fixture,{template:'{home} / {day} / {unknown}'}),'H.O.V.N.A. / neděle / {unknown}');
 assert.match(invitationText({...fixture,time:null}),/Bude upřesněno/);
});
test('Game Day text describes only fixtures in the current exported Story',()=>{
 const text=gameDayText([fixture],{organization:'PHM'});assert.match(text,/20:00 · SPM Aréna/);assert.match(text,/neděle/);assert.equal(gameDayText([]),'');
});
test('native share receives one image and its matching editable invitation text',async()=>{
 const file=new File(['PNG'],'invitation.png',{type:'image/png'}),calls=[];
 const result=await shareInvitation({file,text:'Custom message',navigatorApi:{canShare:v=>v.files[0]===file&&v.text==='Custom message',share:async v=>calls.push(v)},open:()=>assert.fail('unexpected fallback'),download:()=>assert.fail('unexpected download')});
 assert.equal(result,'shared');assert.equal(calls[0].files[0],file);assert.equal(calls[0].text,'Custom message');
});
test('WhatsApp fallback downloads the image and passes text only; cancellation does nothing',async()=>{
 const file=new File(['PNG'],'invitation.png',{type:'image/png'}),calls=[];
 assert.equal(await shareInvitation({file,text:'Ahoj & neděle',navigatorApi:{canShare:()=>false},download:v=>calls.push(v),open:url=>calls.push(url)}),'fallback');assert.equal(calls[0],file);assert.equal(new URL(calls[1]).searchParams.get('text'),'Ahoj & neděle');
 const error=Object.assign(new Error('cancelled'),{name:'AbortError'});assert.equal(await shareInvitation({file,text:'x',navigatorApi:{canShare:()=>true,share:async()=>{throw error;}},open:()=>assert.fail('must not share after cancel'),download:()=>assert.fail('must not download after cancel')}),'cancelled');
});
