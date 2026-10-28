import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshFeedMedia} from '../src/app/feed-media.js';
import {renderPriklepyPage} from '../src/web/render.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const host='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/';
const item={gameId:id(1),teamId:id(2),playerId:id(3),player:'Alexis Roy',team:'Guardians',homeTeam:'Guardians',awayTeam:'Lions',date:'2026-10-18',teamLogoUrl:host+'obsolete.png',playerImageUrl:null,type:'HATTRICK',importance:95,id:'moment',facts:{goals:3}};
const game={startDate:item.date,HomeTeam:{teamId:id(2).toUpperCase(),name:'Guardians',logoUrl:host+'current_[size]'},AwayTeam:{teamId:id(4),name:'Lions'},Lineups:[{teamId:id(2),Player:{playerId:id(3),logoUrl:host+'roy_[size]',email:'private@example.test'}}]};
test('current public HMS images replace stale team assets and supply missing player photos, deduplicated per game',async()=>{
 let calls=0;const result=await refreshFeedMedia([item,{...item,id:'other'}],{fetchMetadata:async()=>{calls++;return game;}});
 assert.equal(calls,1);assert.equal(result[0].teamLogoUrl,host+'current_cropped_md');assert.equal(result[0].playerImageUrl,host+'roy_cropped_md');assert.equal(result[0].email,undefined);assert.equal(item.playerImageUrl,null);
});
test('foreign fixture/date/player/team and unavailable or unsafe media never replace valid fallback images',async()=>{
 for(const foreign of [{...game,startDate:'2026-10-19'},{...game,HomeTeam:{...game.HomeTeam,name:'Other'}}])assert.deepEqual(await refreshFeedMedia([item],{fetchMetadata:async()=>foreign}),[item]);
 const [result]=await refreshFeedMedia([item],{fetchMetadata:async()=>({...game,HomeTeam:{...game.HomeTeam,logoUrl:'https://evil.test/logo'},Lineups:[{...game.Lineups[0],teamId:id(9)}]})});
 assert.equal(result.teamLogoUrl,item.teamLogoUrl);assert.equal(result.playerImageUrl,null);
 assert.deepEqual(await refreshFeedMedia([item],{fetchMetadata:async()=>{throw Error('offline')}}),[item]);
});
test('compact Insights mode is explicit and standalone version keeps its full layout',()=>{
 const config={organization:{code:'EUCHL',slug:'euchl',name:'EUCHL'},lang:'en',mode:'selection'};
 assert.match(renderPriklepyPage([item],{...config,embed:true}),/<body class="embedded-feed">/);
 assert.doesNotMatch(renderPriklepyPage([item],config),/<body class="embedded-feed">/);
});
