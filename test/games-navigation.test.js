import test from 'node:test';
import assert from 'node:assert/strict';
import {isEmbeddedSchedule,gameReportNavigation} from '../public/games/navigation.js';
const id='f62a7774-98ca-11f1-8bdf-ef2495d048f3';
test('CMS iframe without embed=1 still opens its report outside the frame',()=>{
 const frame={},parent={},params=new URLSearchParams();
 assert.equal(isEmbeddedSchedule(params,{self:frame,top:parent}),true);
 const report=gameReportNavigation(id,'cs',isEmbeddedSchedule(params,{self:frame,top:parent}));
 assert.equal(report.target,'_blank');assert.equal(report.href,'/game-center/'+id+'/public?lang=cs');
 assert.equal(new URL(report.href,'https://app.phmcup.cz/games/phm/2026-2027').host,'app.phmcup.cz');
});
test('standalone schedules preserve same-tab navigation; explicit embedded links still work',()=>{
 const page={},standalone={self:page,top:page};
 assert.equal(isEmbeddedSchedule(new URLSearchParams(),standalone),false);
 assert.equal(gameReportNavigation(id,'en',isEmbeddedSchedule(new URLSearchParams(),standalone)).target,null);
 assert.equal(isEmbeddedSchedule(new URLSearchParams('embed=1'),standalone),true);
 assert.equal(isEmbeddedSchedule(new URLSearchParams('embed=0'),{self:{},top:{}}),true);
 assert.equal(isEmbeddedSchedule(new URLSearchParams(),null),false);
});
test('frame detection never reads cross-origin parent content and fails safely for restricted contexts',()=>{
 const context={self:{},top:new Proxy({},{get:()=>assert.fail('Parent content must never be read')})};
 assert.equal(isEmbeddedSchedule(new URLSearchParams(),context),true);
 const blocked={self:{},get top(){throw Error('Blocked parent');}};
 assert.equal(isEmbeddedSchedule(new URLSearchParams(),blocked),true);
});
