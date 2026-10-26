import test from 'node:test';
import assert from 'node:assert/strict';
import {publicOutputUrl,PUBLIC_ORIGIN} from '../public/public-output.js';
import {channelUrl} from '../public/broadcast/channel.js';
import {mapForOrganization,nodeUrl} from '../public/control/map.js';
import {appsForOrganization} from '../public/control/registry.js';

test('shared public URLs retain organization, language, filters and detail on the PHM domain',()=>{
 for(const base of ['https://hms-insights-five.vercel.app','https://hms-insights-git-codex-hms-visual-map-wendaar.vercel.app','http://localhost:3000']){
  const path='/priklepy/euchl?lang=en&q=Tommy#priklep=abc';
  assert.equal(publicOutputUrl(base+path),PUBLIC_ORIGIN+path);
 }
 assert.equal(new URL(publicOutputUrl('https://old.test//other.test/path')).origin,PUBLIC_ORIGIN);
});
test('public OBS channel never inherits private control fragments or parameters',()=>{
 const id='a'.repeat(48),key='b'.repeat(64);
 const url=new URL(channelUrl(`https://old.test/broadcast/index.html?org=EUCHL#control=${id}.${key}`,id));
 assert.equal(url.origin,PUBLIC_ORIGIN);assert.equal(url.pathname,'/broadcast/index.html');
 assert.equal(url.search,'?mode=channel&channel='+id);assert.equal(url.hash,'');assert.ok(!url.href.includes(key));
 assert.equal(new URL(channelUrl('https://preview.test/broadcast/',id,{sandbox:true})).origin,'https://preview.test');
});
test('public launchers use PHM while administration, external tools and planned organizations stay separate',()=>{
 for(const org of ['phm','euchl']){
  const nodes=mapForOrganization(org).flatMap(b=>b.nodes),node=id=>nodes.find(n=>n.id===id);
  for(const id of ['insights-public','insights-archive'])assert.equal(new URL(nodeUrl(node(id),org)).origin,PUBLIC_ORIGIN);
  const schedule=nodeUrl(node('games-view'),org,{gamesPath:`/games/${org}/2026-2027`});assert.equal(schedule,PUBLIC_ORIGIN+`/games/${org}/2026-2027`);
  assert.ok(nodeUrl(node('obs-definition'),org).startsWith('/broadcast/'));
 }
 const playoff=appsForOrganization('phm').find(a=>a.id==='playoff-players');
 assert.ok(playoff.links.manage.startsWith('/control/'));assert.equal(new URL(playoff.links.public).origin,PUBLIC_ORIGIN);
 const stars=appsForOrganization('phm').find(a=>a.id==='all-stars');
 assert.equal(stars.links.open,'/control/apps/all-stars?org=phm');assert.equal(stars.links.public,PUBLIC_ORIGIN+'/all-stars/phm');
 assert.ok(mapForOrganization('yhg').flatMap(b=>b.nodes).every(n=>nodeUrl(n,'yhg')===null));
});
