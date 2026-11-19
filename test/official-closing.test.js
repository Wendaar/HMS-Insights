import test from 'node:test';
import assert from 'node:assert/strict';
import {closingScope, closingStandings, closingAwards, closingDraft, approveClosing} from '../src/domain/official-closing.js';

const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const scope = {organization:'phm',seasonId:ids[0],competitionId:ids[1],type:'phase',phaseId:ids[2]};
const eligibility = {teamIds:[ids[0],ids[1]],playerTeamPairs:[{playerId:ids[2],teamId:ids[0]}]};

test('scope validates explicit competition/group/phase relationships',()=>{
  assert.equal(closingScope(scope).type,'phase');
  assert.throws(()=>closingScope({...scope,type:'competition'}), /competition scope/);
  assert.throws(()=>closingScope({...scope,organization:'unknown org'}), /organization/);
  assert.throws(()=>closingScope({...scope,phaseId:ids[3].slice(2)}), /phaseId/);
});
test('official standings support joint places and explicit medals',()=>{
  const rows = closingStandings([{teamId:ids[1],rank:1,medal:'gold'},{teamId:ids[0],rank:1,medal:'gold'}],eligibility.teamIds);
  assert.equal(rows.length,2);
  assert.equal(rows[0].rank,1);
  assert.throws(()=>closingStandings([{teamId:ids[0],rank:1},{teamId:ids[0],rank:2}],eligibility.teamIds), /duplicate/);
  assert.throws(()=>closingStandings([{teamId:ids[3],rank:1}],eligibility.teamIds), /ineligible/);
});
test('awards bind players to team and disallow duplicated categories',()=>{
  assert.deepEqual(closingAwards([{category:'mvp',playerId:ids[2],teamId:ids[0]}],eligibility.playerTeamPairs)[0].category,'mvp');
  assert.throws(()=>closingAwards([{category:'mvp',playerId:ids[2],teamId:ids[1]}],eligibility.playerTeamPairs), /ineligible/);
  assert.throws(()=>closingAwards([{category:'mvp',playerId:ids[2],teamId:ids[0]},{category:'mvp',playerId:ids[2],teamId:ids[0]}],eligibility.playerTeamPairs), /duplicate/);
});
test('approval snapshots detached data and blocks reapproval',()=>{
  const draft=closingDraft({title:'Final 2026',scope,standings:[{teamId:ids[0],rank:1,medal:'gold'}],awards:[]},eligibility);
  const closed=approveClosing(draft,{actorId:ids[3],approvedAt:'2026-11-18T17:00:00Z',version:1});
  draft.standings[0].rank=8;
  assert.equal(closed.standings[0].rank,1);
  assert.equal(closed.status,'closed');
  assert.ok(Object.isFrozen(closed.standings[0]));
  assert.throws(()=>approveClosing(closed,{actorId:ids[3],approvedAt:'2026-11-18T17:00:00Z',version:2}), /draft status/);
});
