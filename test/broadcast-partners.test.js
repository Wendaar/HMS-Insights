import test from 'node:test';
import assert from 'node:assert/strict';
import {teamPartners} from '../public/broadcast/partner-playlist.js';
import {renderExtraLayer} from '../public/broadcast/extra-layers.js';
import {broadcastLibrary} from '../src/domain/broadcast-library.js';
import {channelState} from '../src/web/broadcast-channel.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const game={ID:id(1),homeId:id(2),awayId:id(3),'Home Team':'Guardians','Away Team':'Capitals'};
const catalog={org:'EUCHL',items:[{id:id(4),name:'Partner A',claim:'Claim A',web:'https://example.com',scopeRefs:{teamIds:[id(2)]}},{id:id(5),name:'Partner B',scopeRefs:{teamIds:[id(2)]}},{id:id(6),name:'Other',scopeRefs:{teamIds:[id(3)]}}],bindings:[]};
const ref=(sponsorId,enabled=true,targetId=id(2))=>({id:id(Number(sponsorId.slice(-2))+100),kind:'hms-sponsor',org:'EUCHL',scope:'team',targetId,sponsorId,enabled});
test('team partner playlist takes exact HMS membership, then saved order and enabled flags; stale and unrelated references cannot add sponsors',()=>{
  assert.deepEqual(teamPartners(catalog,game).map(a=>a.title),['Partner A','Partner B']);
  const rules=[ref(id(5)),ref(id(4),false),ref(id(6)),ref(id(4),true,id(3))];assert.deepEqual(teamPartners(catalog,game,'home',rules).map(a=>a.title),['Partner B']);
  assert.equal(teamPartners(catalog,game,'away',rules).length,0);assert.equal(teamPartners(null,game).length,0);
  assert.equal(teamPartners(catalog,game,'home',[ref(id(4),false),ref(id(5),false)]).length,0);
});
test('HMS rules persist references only and cannot inject display URLs or change source records',()=>{
  const value=broadcastLibrary([{...ref(id(4)),url:'https://evil.test',image:'anything',title:'Fake'}])[0];assert.deepEqual(value,ref(id(4)));assert.throws(()=>broadcastLibrary([{...ref(id(4)),scope:'organization'}]));
});
test('small and full-screen partners share the saved playlist and rotate deterministically; empty HMS selection remains transparent',()=>{
  for(const layer of ['sponsors','announcement']){
    const settings={layer,org:'EUCHL',partnerSource:'hms',sponsorCatalog:catalog,rotationIndex:1};
    const html=renderExtraLayer(game,settings);assert.match(html,/Partner B/);assert.doesNotMatch(html,/Other|Claim A/);assert.match(html,/Guardians/);
    assert.equal(renderExtraLayer(game,{...settings,items:[ref(id(4),false),ref(id(5),false)]}),'');
    assert.equal(renderExtraLayer(game,{...settings,sponsorCatalog:{...catalog,org:'PHM'}}),'');
  }
});
test('channel validates new output and source, preserving former layers and optional settings',()=>{
  const state={org:'EUCHL',gameId:id(1),lang:'cs',layer:'announcement',side:'home',period:'current',page:1,insight:'',visible:false,partnerSource:'hms'};
  const env={HMS_EUCHL_ORGANIZATION_ID:id(9),HMS_EUCHL_API_TOKEN:'test'};assert.equal(channelState(state,env).layer,'announcement');assert.throws(()=>channelState({...state,partnerSource:'external'},env));
});
