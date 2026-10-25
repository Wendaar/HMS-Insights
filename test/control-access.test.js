import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapForOrganization} from '../public/control/map.js';

test('readiness and intended access are distinct, never claimed verified', () => {
 const nodes=mapForOrganization('euchl').flatMap(x=>x.nodes);
 const games=nodes.find(x=>x.id==='games-view');
 assert.equal(games.access.type,'PUBLIC');
 assert.equal(games.access.verified,false);
 assert.equal(nodes.find(x=>x.id==='obs-definition').access.type,'ADMIN');
 assert.equal(nodes.find(x=>x.id==='gameshow-control').access.type,'PLANNED');
});

test('PHM embeds allowed only for games and game center, not control', () => {
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const headers=source=>config.headers.find(h=>h.source===source).headers;
 for(const source of ['/games/:path*','/game-center']){
  const csp=headers(source).find(h=>h.key==='Content-Security-Policy').value;
  assert.match(csp,/frame-ancestors 'self' https:\/\/phmcup.cz https:\/\/www.phmcup.cz/);
 }
 assert.match(headers('/control/:path*').find(h=>h.key==='Content-Security-Policy').value,/frame-ancestors 'none'/);
});
