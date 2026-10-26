import test from 'node:test';
import assert from 'node:assert/strict';
import {workChats,workChatFor,workChatHref} from '../public/control/work-chats.js';
import {mapForOrganization,nodeUrl} from '../public/control/map.js';

test('OBS tools and sponsor layers point to the verified OBS work without altering tool launches',()=>{
 for(const id of ['obs-definition','obs-studio','obs-output','sponsor-definition','sponsor-broadcast','sponsor-output']){
  const node=mapForOrganization('phm').flatMap(b=>b.nodes).find(n=>n.id===id);
  const chat=workChatFor(node.application?.id,node.id);assert.equal(chat.title,'HMS Control Center for OBS V1');
  assert.equal(workChatHref(chat),'codex://threads/01a165c4-e60e-72d1-b153-1dc4f418af12');
  if(node.status==='Planned')assert.equal(nodeUrl(node,'phm'),null);
 }
});
test('verified chats distinguish tools and planned modernization from unassigned work',()=>{
 assert.equal(workChatFor('game-center'),workChats.games);assert.equal(workChatFor('studio'),workChats.media);
 for(const id of ['insights-public','insights-definition','insights-archive'])assert.equal(workChatFor(id),workChats.insights);
 for(const id of ['all-stars','team-comparison','betting','playoff-players','player-cards','playoff-bracket'])assert.equal(workChatFor(id),workChats.legacy);
 assert.equal(workChatFor('operations'),workChats.operations);assert.equal(workChatFor('gameshow-control'),null);
 assert.equal(workChatFor('unknown'),null);
});
test('chat links use supported destinations without granting access or creating shared snapshots',()=>{
 assert.equal(workChatHref(workChats.media),'https://chatgpt.com/c/6ad7fd70-ff8c-83eb-a22a-d7c8f1230297');
 for(const chat of Object.values(workChats))assert.ok(workChatHref(chat));
 for(const chat of [null,{id:'javascript:alert(1)',kind:'codex'},{id:workChats.games.id,kind:'unknown'}])assert.equal(workChatHref(chat),null);
});
