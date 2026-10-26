import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {organizations, categories, statuses, appsForOrganization, organizationById, gameReportUrl, filterApps} from '../public/control/registry.js';
import {isGameId} from '../src/domain/game-summary.js';
import {server} from '../src/server.js';

test('registry covers the inventory, with explicit unconfigured organization isolation',()=>{
  const apps=appsForOrganization('PHM');
  assert.equal(apps.length,32);assert.equal(new Set(apps.map(a=>a.id)).size,apps.length);
  for(const app of apps){
    assert.ok(categories.some(c=>c.id===app.category));assert.ok(statuses[app.status]);assert.ok(app.dataSource);
    for(const href of Object.values(app.links))assert.match(href,/^(https:\/\/|\/(?!\/))/);
    if(app.status==='missing')assert.deepEqual(app.links,{});
  }
  for(const org of organizations.filter(o=>!o.ready)){
    const entries=appsForOrganization(org.id);assert.equal(entries.length,apps.length);
    for(const app of entries){assert.deepEqual(app.links,{});assert.equal(app.gamePath,undefined);assert.equal(app.status,'prepared');assert.equal(app.dataSource,'Nenastaveno');}
    assert.equal(gameReportUrl(org.id,'f6321894-98ca-11f1-8bdf-ef2495d048f3'),null);
  }
  assert.equal(organizationById('evil'),null);assert.deepEqual(appsForOrganization('evil'),[]);
  assert.equal(organizationById('PHM').id,'phm');
});
test('Game Center generates the existing route and matches its UUID validation',()=>{
  const id='F6321894-98CA-11F1-8BDF-EF2495D048F3';
  assert.equal(gameReportUrl('phm',` ${id} `),`https://app.phmcup.cz/game-center/${id}`);
  for(const value of ['',null,'https://example.com',`${id}/public`,`${id}?org=YHG`,'<script>', '1234',id]){
    assert.equal(!!gameReportUrl('phm',value),isGameId(value));
  }
});
test('search handles Czech accents, multiple words and combined filters',()=>{
  const apps=appsForOrganization('phm');
  assert.deepEqual(filterApps(apps,{query:'porovnani tymu'}).map(a=>a.id),['team-comparison']);
  assert.deepEqual(filterApps(apps,{category:'data',status:'available'}).map(a=>a.id),['import-game','backfill','data-engine']);
  assert.equal(filterApps(apps,{query:'unfindable'}).length,0);
});
test('verified GitHub file links resolve to files in this repository',async()=>{
  for(const app of appsForOrganization('phm'))for(const href of Object.values(app.links)){
    const prefix='https://github.com/Wendaar/HMS-Insights/blob/main/';
    if(href.startsWith(prefix))await access(new URL('../'+href.slice(prefix.length),import.meta.url));
  }
});
test('control routes and assets work locally without altering Studio, feeds or reports',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const path of ['/control','/control/','/control/index.html','/control/app.js','/control/registry.js','/control/map.js','/control/work-chats.js','/control/control.css']){
      const response=await fetch(root+path);assert.equal(response.status,200,path);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
      assert.ok((await response.text()).length>100);
    }
    assert.equal((await fetch(root+'/control',{method:'POST'})).status,405);
    assert.equal((await fetch(root+'/control',{method:'HEAD'})).status,200);
    for(const path of ['/studio','/studio/phm','/priklepy/phm','/archiv/phm','/game-center/f6321894-98ca-11f1-8bdf-ef2495d048f3']){
      assert.equal((await fetch(root+path)).status,200,path);
    }
    assert.equal((await fetch(root+'/control/not-a-file.js')).status,404);
    const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
    assert.equal(config.rewrites.find(r=>r.source==='/control').destination,'/control/index.html');
    for(const path of ['/studio','/priklepy','/archiv','/game-center/:gameId','/admin/import-game','/admin/backfill'])assert.ok(config.rewrites.some(r=>r.source===path));
  }finally{await new Promise(resolve=>server.close(resolve));}
});
