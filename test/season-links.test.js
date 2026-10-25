import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonLinks} from '../src/domain/season-links.js';
import {controlSeasonLink} from '../src/app/control-context.js';
const org='BB669217-41EB-4162-8040-A73F49A43570',id='E6134160-47CF-11F1-A223-BFDFBDD3A64B';
test('readable season paths omit UUIDs and disambiguate competitions',()=>{
 const one=seasonLinks('euchl',[{seasonId:id,season:'2026–2027',competition:'European Union College Hockey League'}]);assert.equal(one[0].gamesPath,'/games/euchl/2026-2027');
 const two=seasonLinks('phm',[{season:'2026/2027',competition:'PHM Cup'},{season:'2026/2027',competition:'Letní pohár'}]);assert.equal(two[0].gamesPath,'/games/phm/phm-cup/2026-2027');assert.equal(two[1].gamesPath,'/games/phm/letni-pohar/2026-2027');
 assert.ok(seasonLinks('phm',[{season:'2026',competition:'A'},{season:'2026',competition:'A'}]).every(item=>item.gamesPath===null));
});
test('legacy links resolve through verified stored ownership; unknown or ambiguous seasons get no alias',async()=>{
 const options={env:{},loadControlSeason:async()=>[{organization_id:org}],loadLeagues:async()=>[{organization_id:org,season_id:id,competition_name:'PHM Cup',season_name:'2026-2027'}]};
 assert.equal((await controlSeasonLink(id,options)).path,'/games/phm/2026-2027');
 assert.equal((await controlSeasonLink(id,{...options,loadControlSeason:async()=>[]})).path,null);
 assert.equal((await controlSeasonLink(id,{...options,loadControlSeason:async()=>[{organization_id:org},{organization_id:id}]})).path,null);
 await assert.rejects(controlSeasonLink('bad',options));
});
