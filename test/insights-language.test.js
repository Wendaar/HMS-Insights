import test from 'node:test';
import assert from 'node:assert/strict';
import {feedLanguage,insightCopy} from '../public/insights-i18n.js';
import {renderPriklepyPage,renderFeedCards} from '../src/web/render.js';
import {createPublicFeedHandler} from '../src/web/public-feed-handler.js';
import {feedDemo} from '../src/app/feed-demo.js';
test('English public Insights translates facts, chrome and dates without changing names or source data',()=>{
 const items=feedDemo.map(item=>({...item,player:item.player?'Hattrick Novák':item.player})),before=JSON.stringify(items);
 const page=renderPriklepyPage(items,{mode:'selection',organization:{code:'EUCHL',slug:'euchl',name:'EUCHL'}});
 assert.match(page,/<html lang="en">/);assert.match(page,/The best from the ice/);assert.match(page,/Find a player, team or highlight/);assert.match(page,/Clear all filters/);
 assert.match(page,/Hattrick Novák/);assert.match(page,/scored|recorded|made|won by/);assert.equal(JSON.stringify(items),before);
 const data=JSON.parse(page.match(/id="feed-data">(.*?)<\/script>/s)[1]);assert.deepEqual(data,items);
 assert.match(page,/href="\/priklepy\/euchl\?lang=cs"/);
 const cs=renderPriklepyPage(items,{mode:'selection',lang:'cs',organization:{code:'EUCHL',slug:'euchl',name:'EUCHL'}});assert.match(cs,/<html lang="cs">/);assert.match(cs,/To nejlepší z ledu/);
});
test('all supported insight types use existing facts, with safe missing-fact text',()=>{
 const facts={goals:4,assists:2,points:6,saves:31,scoreDifference:7,gameTime:'0:22'};
 for(const [type,expected]of [['HATTRICK','scored 4 goals'],['MULTIPOINT_GAME','6 points (4 goals + 2 assists)'],['BIG_SAVES','31 saves'],['EARLY_GOAL','0:22'],['BIG_WIN','won by 7 goals']])assert.ok(insightCopy({type,player:'Jan Novák',facts},'en').text.includes(expected));
 assert.equal(insightCopy({type:'BIG_WIN',team:'HC Goals',facts:{}},'en').text,'HC Goals recorded a big win.');
 assert.equal(insightCopy({type:'MULTIPOINT_GAME',player:'Tommy',facts:{points:5,goals:1,assists:4},venue:'Neuvedený stadion'},'en').text,'Tommy recorded 5 points (1 goal + 4 assists).');
 assert.equal(insightCopy({venue:'Neuvedený stadion'},'en').venue,'Venue not specified');
 assert.equal(feedLanguage(null,'EUCHL'),'en');assert.equal(feedLanguage('en','PHM'),'en');assert.equal(feedLanguage('cs','EUCHL'),'cs');
});
test('English API pagination returns translated markup and unchanged canonical items',async()=>{
 const items=[feedDemo.find(item=>item.type==='HATTRICK')];
 const response={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await createPublicFeedHandler({env:{},loadSelection:async()=>({items,total:1,hasMore:false})})({method:'GET',query:{org:'PHM',lang:'en'}},response);
 assert.equal(response.code,200);assert.deepEqual(response.body.items,items);assert.match(response.body.html,/scored/);assert.match(response.body.html,/Open details/);
 assert.match(renderFeedCards(items,40,'en'),/scored/);
});
