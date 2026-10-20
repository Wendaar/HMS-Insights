import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGameTimeline} from '../src/domain/game-timeline.js';
import {eventRecordedAt} from '../src/hms/event-snapshot.js';
import {enrichEventGroups} from '../src/hms/public-event-metadata.js';
import {renderInteractiveTimeline} from '../src/web/game-report-interactive.js';
const home='11111111-1111-4111-8111-111111111111',away='22222222-2222-4222-8222-222222222222';
const goal=(id,clockSeconds,recordedAt,period=1)=>({id,type:'goal',teamId:home,clock:clockSeconds===null?null:`${Math.floor(clockSeconds/60)}:00`,clockSeconds,recordedAt,period,player:{id:home,name:'Střelec'},assists:[],details:{shotZone:{name:'Between the circles'},netZone:{name:'Left side'}}});
const game=events=>({home_team_id:home,away_team_id:away,home_score:events.filter(e=>e.type==='goal').length,away_score:0,event_snapshot:{version:1,clockBasis:'game-elapsed',collections:{goals:true,penalties:true,saves:false},events}});
test('missing clock events retain known goal zones and use recording order without fake game times or scores',()=>{
  const timeline=buildGameTimeline(game([goal('last',180,'2026-10-20T17:03:00Z'),goal('missing',null,'2026-10-20T17:02:00Z'),goal('first',60,'2026-10-20T17:01:00Z')]));
  assert.equal(timeline.available,true);assert.equal(timeline.displayOrder,'recorded-at');assert.equal(timeline.ordered,false);
  assert.deepEqual(timeline.events.map(e=>e.id),['first','missing','last']);
  const missing=timeline.events[1];assert.equal(missing.clock,null);assert.equal(missing.clockSeconds,null);assert.equal(missing.scoreAfter,null);
  assert.equal(missing.details.shotZone.code,'between-circles');assert.equal(missing.details.netZone.code,'left-side');assert.equal(timeline.unplacedEvents,0);
  assert.deepEqual(timeline.periodScores,[{period:1,home:3,away:0}]);
  const html=renderInteractiveTimeline({players:[],goalies:[],home:{id:home,name:'Domácí'},away:{id:away,name:'Hosté'},timeline});assert.match(html,/Zápis 19:02/);assert.match(html,/Čas zápisu nenahrazuje herní čas/);
});
test('source periods have priority and recording order never enables PP interval estimates',()=>{
  const events=[goal('period-two',null,'2026-10-20T17:00:00Z',2),goal('period-one',null,'2026-10-20T17:05:00Z',1)];
  const t=buildGameTimeline(game(events));assert.deepEqual(t.events.map(e=>e.id),['period-one','period-two']);assert.equal(t.specialTeams.available,false);
});
test('partial timestamps do not manufacture chronological placement',()=>{
  const t=buildGameTimeline(game([goal('known',60,'2026-10-20T17:00:00Z'),goal('unknown',null,null)]));
  assert.equal(t.displayOrder,'partial');assert.equal(t.unplacedEvents,1);assert.equal(t.events.at(-1).id,'unknown');
});
test('recording timestamp is allowlisted, validates ISO offsets and falls back to creation time',()=>{
  assert.equal(eventRecordedAt({timestamp:'2026-10-20T19:02:03+02:00'}),'2026-10-20T17:02:03.000Z');
  assert.equal(eventRecordedAt({timestamp:'bad',createdAt:'2026-10-20T17:02:03Z'}),'2026-10-20T17:02:03.000Z');
  assert.equal(eventRecordedAt({timestamp:'<script>alert(1)</script>'}),null);
});
test('uniquely timestamped goals without a clock can receive matching public zone labels',()=>{
  const event={scoredByTeamId:home,period:1,gameTime:null,timestamp:'2026-10-20T17:02:03Z',listEventLocationId:'zone-id'};
  const groups={goals:{events:[event]},penalties:{events:[]},saves:{events:[]}};
  const metadata={HomeTeamGoals:1,AwayTeamGoals:0,GameEvents:[{...event,entity:'GameEventGoal',ListEventLocation:{listEventLocationId:'zone-id',name:'Between the circles'}}]};
  enrichEventGroups(groups,metadata,{HomeTeamGoals:1,AwayTeamGoals:0});assert.equal(groups.goals.events[0].ListEventLocation.name,'Between the circles');
});
