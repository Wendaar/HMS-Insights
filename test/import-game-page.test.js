import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/import-game-page.js';
const response=()=>({setHeader(){},status(n){this.code=n;return this;},send(body){this.body=body;}});
test('import page preselects only an explicitly linked valid game and has no fixed match',()=>{
  const id='F631CA7A-98CA-11F1-8BDF-EF2495D048F3',res=response();handler({method:'GET',query:{gameId:id}},res);assert.match(res.body,new RegExp(`id="gameId" value="${id}"`));
  for(const query of [{},{gameId:'" onfocus="alert(1)'},{gameId:[id]}]){const r=response();handler({method:'GET',query},r);assert.match(r.body,/id="gameId" value="" required/);assert.doesNotMatch(r.body,/F6321894|onfocus/);}
});
