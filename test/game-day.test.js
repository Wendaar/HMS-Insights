import test from 'node:test';
import assert from 'node:assert/strict';
import {managerContacts,reminderConfig,matchPreview,gameDay,invitation,invitationHtml} from '../src/app/game-day.js';
import {queueReminder,processReminders,fixtureInstant,scheduleReminders} from '../src/app/reminders.js';
import {ecomailAdapter} from '../src/infrastructure/reminder-email.js';
import {createGameDayHandler} from '../src/web/game-day-handler.js';
import {reminderStore} from '../src/infrastructure/reminder-store.js';
const orgId='bb669217-41eb-4162-8040-a73f49a43570',gameId='11111111-1111-1111-1111-111111111111',homeId='22222222-2222-2222-2222-222222222222',awayId='33333333-3333-3333-3333-333333333333';
const now=new Date('2026-10-30T10:00:00Z');
const preview={org:'PHM',gameId,eligible:true,date:'2026-10-31',time:'20:00',competitionId:homeId,home:{id:homeId,name:'Home',jerseyColor:'#ffffff'},away:{id:awayId,name:'Away'},links:{game:'/game-center/'+gameId,compare:'/team-comparison/phm'}};
function memory(){const jobs=new Map(),logs=[];let settings={config:{enabled:true},contacts:[{teamId:homeId,email:'test@example.com'}]};return{jobs,logs,settings:async()=>settings,save:async(o,c)=>{settings.config=c;},contacts:async(o,c)=>{settings.contacts=c;},log:async()=>[...jobs.values()],enqueue:async(o,g,r,p)=>{const key=o+g+r;if(jobs.has(key))return 0;jobs.set(key,{id:key,game_id:g,recipient:r,payload:p,status:'queued',attempts:0});return 1;},claim:async()=>{const job=[...jobs.values()].find(j=>['queued','retry'].includes(j.status)&&j.attempts<3);if(job){job.status='processing';job.attempts++;}return job;},finish:async(j,outcome)=>{j.status=outcome==='simulated'?'simulated':j.attempts>=3?'failed':'retry';logs.push(outcome);}};}
test('contacts CSV accepts BOM, quotes, semicolons and multiple scoped managers; rejects foreign, duplicate and malformed rows atomically',()=>{
 const header='organisation_id;team_id;email;name\r\n';
 assert.deepEqual(managerContacts('\uFEFF'+header+`${orgId};${homeId};TEST@example.com;"A; B"`,orgId),[{teamId:homeId,email:'test@example.com',name:'A; B'}]);
 for(const body of [`${gameId};${homeId};a@b.cz;A`,`${orgId};bad;a@b.cz;A`,`${orgId};${homeId};a@b.cz;"A`,`${orgId};${homeId};a@b.cz;A\n${orgId};${homeId};a@b.cz;B`,`${orgId};${homeId};a@b.cz;"a"extra`])assert.throws(()=>managerContacts(header+body,orgId));
 assert.throws(()=>managerContacts('x'.repeat(200001),orgId));
});
test('configuration is disabled by default, validates schedules, branding, language and team IDs',()=>{
 assert.equal(reminderConfig().enabled,false);assert.equal(reminderConfig({schedule:{tournament:2}}).schedule.league,24);
 for(const v of [{enabled:'yes'},{schedule:{league:-1}},{schedule:{league:169}},{language:'xx'},{recipientTeamIds:['bad']},{branding:{accent:'red'}},{competitionTypes:{[homeId]:'cup'}}])assert.throws(()=>reminderConfig(v));
});
test('shared previews bind fixture identity and never attach current tables to finished historical fixtures',async()=>{
 const game={...preview,playedOn:preview.date,status:'NOT PLAYED',seasonId:homeId,groupId:homeId,phaseId:homeId};let calls=0;
 const options={now,mediaGame:async()=>game,compare:async()=>{calls++;return{teams:[{id:homeId,rank:2,players:[],form:[],roster:{average:null}}]};}};
 const p=await matchPreview('PHM',gameId,options);assert.equal(p.home.preview.rank,2);assert.equal(p.away.preview,null);assert.equal(calls,1);
 game.status='FINISHED';assert.equal((await matchPreview('PHM',gameId,options)).statistics,'unavailable');assert.equal(calls,1);
 game.org='EUCHL';await assert.rejects(matchPreview('PHM',gameId,options));
});
test('day browse forwards exact date, preserves paging, validates source date and does not load comparison per row',async()=>{
 let called;const options={now,browseMedia:async input=>{called=input;return{items:[{gameId}],hasMore:true,source:'test-fixture'};},mediaGame:async()=>({...preview,status:'NOT PLAYED',playedOn:'2026-10-31'}),compare:async()=>{throw Error('must not run');}};
 const p=await gameDay('PHM',{date:'2026-10-31',offset:20},options);assert.equal(called.date,'2026-10-31');assert.equal(p.items.length,1);assert.equal(p.hasMore,true);
 assert.equal((await gameDay('PHM',{date:'2026-10-31',venue:'elsewhere'},options)).items.length,0);
 await assert.rejects(gameDay('PHM',{date:'2026-02-30'},options));await assert.rejects(gameDay('PHM',{date:'2026-10-30'},options));
});
test('Prague kickoff handles midnight, winter, summer, impossible and ambiguous DST times',()=>{
 assert.equal(fixtureInstant('2026-10-31','20:00'),Date.parse('2026-10-31T19:00:00Z'));
 assert.equal(fixtureInstant('2026-07-01','00:15'),Date.parse('2026-06-30T22:15:00Z'));
 assert.equal(fixtureInstant('2026-03-29','02:30'),null);assert.equal(fixtureInstant('2026-10-25','02:30'),null);assert.equal(fixtureInstant('2026-10-31',null),null);
});
test('manual queue deduplicates team managers and repeated requests; processing is test only',async()=>{
 const store=memory(),options={store,now,preview:async()=>preview};
 assert.equal((await queueReminder('PHM',gameId,options)).queued,1);assert.equal((await queueReminder('PHM',gameId,options)).queued,0);
 assert.equal((await processReminders('PHM',options)).processed,1);assert.deepEqual(store.logs,['simulated']);assert.equal((await processReminders('PHM',options)).processed,0);
});
test('queue excludes disabled, expired, unknown kickoff and invalid jersey requests',async()=>{
 const store=memory(),options={store,now,preview:async()=>preview};
 for(const p of [{...preview,eligible:false},{...preview,date:'2026-10-29'},{...preview,time:null}])await assert.rejects(queueReminder('PHM',gameId,{...options,preview:async()=>p}));
 await assert.rejects(queueReminder('PHM',gameId,{...options,jerseys:{home:'red'}}));await store.save(orgId,{enabled:false});await assert.rejects(queueReminder('PHM',gameId,options));
});
test('recipient restrictions and per-match jersey overrides remain isolated from HMS',async()=>{
 const store=memory();await store.save(orgId,{enabled:true,recipientTeamIds:[awayId]});assert.equal((await queueReminder('PHM',gameId,{store,now,preview:async()=>preview})).queued,0);
 await store.save(orgId,{enabled:true});await queueReminder('PHM',gameId,{store,now,preview:async()=>preview,jerseys:{home:'#abcdef'}});assert.match([...store.jobs.values()][0].payload.text,/#abcdef/);assert.equal(preview.home.jerseyColor,'#ffffff');
});
test('provider failures stop at three attempts and preserve attempt log',async()=>{
 const store=memory();await queueReminder('PHM',gameId,{store,now,preview:async()=>preview});const email={send:async()=>{throw Error('secret must not enter log');}};
 await processReminders('PHM',{store,email});assert.equal([...store.jobs.values()][0].status,'failed');assert.deepEqual(store.logs,['provider-failed','provider-failed','provider-failed']);
});
test('Ecomail test adapter cannot invoke network transport; unverified production rejects',async()=>{
 let sent=false;assert.deepEqual(await ecomailAdapter({verifiedTransactionalTransport:{send:async()=>{sent=true;}}}).send({}),{outcome:'simulated'});assert.equal(sent,false);await assert.rejects(ecomailAdapter({mode:'production'}).send({}));
});
async function request(query,options={},body,headers={}){const result={headers:{}};await createGameDayHandler(options)({query,method:body===undefined?'GET':'POST',headers,body},{setHeader:(k,v)=>{result.headers[k]=v;},status(c){result.status=c;return this;},json(b){result.body=b;}});return result;}
test('private API rejects anonymous, wrong-org and cron credentials, and rejects production even with valid organization key',async()=>{
 const secret='a'.repeat(24),env={HMS_PHM_REMINDER_SECRET:secret,CRON_SECRET:'c'.repeat(24)},store=memory();
 assert.equal((await request({org:'PHM',action:'center'},{env,store})).status,401);
 assert.equal((await request({org:'PHM',action:'center'},{env,store},undefined,{authorization:'Bearer '+env.CRON_SECRET})).status,401);
 assert.equal((await request({org:'PHM',action:'queue'},{env,store},{mode:'production'},{authorization:'Bearer '+secret})).status,400);
 assert.equal((await request({org:'PHM',action:'center'},{env,store},undefined,{authorization:'Bearer '+secret})).body.mode,'test');
 assert.equal((await request({action:'cron'},{env,store})).status,401);
 const bad=await request({org:'PHM',action:'config'},{env,store},'bad',{authorization:'Bearer '+secret});assert.equal(bad.status,400);assert.equal(bad.headers['Cache-Control'],'private, no-store');
});
test('scheduler uses competition-specific lead times, skips disabled organizations and is idempotent',async()=>{
 const store=memory();await store.save(orgId,{enabled:true,automatic:true,schedule:{league:24,tournament:3},competitionTypes:{[homeId]:'tournament'}});
 const day=async(org,{date})=>({items:date===preview.date?[preview]:[],hasMore:false});
 const options={store,now:new Date('2026-10-31T17:00:00Z'),day,preview:async()=>preview,env:{HMS_STUDIO_ORGANIZATIONS:'[]'}};
 await scheduleReminders({...options,now:new Date('2026-10-31T10:00:00Z')});assert.equal(store.jobs.size,0);
 await scheduleReminders(options);assert.equal(store.jobs.size,1);await scheduleReminders(options);assert.equal(store.jobs.size,1);
});
test('durable SQL scopes reads and retry by organization, atomically claims with skip locked, and logs no provider error',async()=>{
 const calls=[],sql={query:async(text,args)=>{calls.push({text,args});return[];}},store=reminderStore({sql});
 await store.claim(orgId);await store.retry(orgId,1);await store.enqueue(orgId,gameId,'test@example.com',{});await store.finish({id:1,attempts:1},'provider-failed');
 assert.match(calls[0].text,/worker-expired/);assert.match(calls[1].text,/for update skip locked/);assert.equal(calls[0].args[0],orgId);assert.match(calls[2].text,/organization=\$1/);assert.match(calls[3].text,/on conflict do nothing/);assert.match(calls[4].text,/attempts=\$2/);
});
test('invitation localizes unknowns, includes verified links, never invents stats',()=>{const text=invitation(preview,{language:'en'});assert.match(text,/Unavailable/);assert.match(text,/game-center/);assert.doesNotMatch(text,/Rank: 0/);});

test('HTML invitation escapes source labels and binds safe canonical links',()=>{const html=invitationHtml({...preview,home:{...preview.home,name:'<script>alert(1)</script>'}});assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/https:\/\/app.phmcup.cz/);});
