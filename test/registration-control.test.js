import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {REGISTRATION_SCOPE as scope, registrationPlayer, normalizeRegistrationPages, readRegistrationTeams} from '../src/app/registration-control.js';
import {createRegistrationControlHandler} from '../src/web/registration-control-handler.js';
import {registrationLinkStore, tokenHash} from '../src/infrastructure/registration-links.js';
import {sessionCookie} from '../src/security/operations-session.js';
import {appsForOrganization} from '../public/control/registry.js';
import {server} from '../src/server.js';
import {readFile} from 'node:fs/promises';

const teamId='11111111-1111-4111-8111-111111111111', otherTeamId='22222222-1111-4111-8111-111111111111';
const playerId='33333333-1111-4111-8111-111111111111', oldSeason='44444444-1111-4111-8111-111111111111';
const member=(patch={})=>({playerId,name:'Test hráč',email:'test@example.invalid',status:'ACTIVE',
  invitations:[{seasonId:scope.seasonId,sentAt:'2026-09-01T12:00:00Z'},{seasonId:scope.seasonId,sentAt:'2026-10-02T12:00:00Z'}],
  registration:{seasonId:scope.seasonId,acceptedByPlayer:true,paymentMethod:'COMGATE',paymentStatus:'PAID',status:'CONFIRMED'},...patch});
const page=(patch={})=>({schemaVersion:1,...scope,complete:true,nextCursor:null,teams:[{teamId,name:'Test tým',members:[member()]}],...patch});
const env={HMS_PHM_TOOLS_ADMIN_SECRET:'test-admin-value',DATABASE_URL:'not-a-real-connection'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request=(action,extra={})=>({method:['login','logout','rotate','revoke','exchange','team-logout'].includes(action)?'POST':'GET',
  query:{action},headers:{host:'example.invalid',origin:'https://example.invalid'},...extra});
const bearer={authorization:'Bearer '+env.HMS_PHM_TOOLS_ADMIN_SECRET,host:'example.invalid',origin:'https://example.invalid'};
function memoryStore(){
  let current=null,attempts=0;
  return {async list(){return current?[current]:[];},async rate(_bucket,limit){return ++attempts<=limit;},
    async resolve(token){return current&&!current.revoked_at&&current.token_hash===tokenHash(token)?current:null;},
    async rotate(_scope,id){const token=randomBytes(32).toString('base64url');current={team_id:id,revision:(current?.revision??0)+1,token_hash:tokenHash(token),expires_at:'2027-09-01T00:00:00Z'};return {token,link:current};},
    async revoke(){if(current)current.revoked_at='2026-10-29T12:00:00Z';}};
}
const teams=()=>normalizeRegistrationPages([page({teams:[{teamId,name:'A',members:[member()]},{teamId:otherTeamId,name:'B',members:[member({email:'OTHER-TEAM-PRIVATE'})]}]})]);

test('ACTIVE members remain; INVITED requires this season ID, never invitation calendar year',()=>{
  assert.ok(registrationPlayer(member({invitations:[],registration:null})));
  assert.equal(registrationPlayer(member({status:'INVITED',invitations:[{seasonId:oldSeason,sentAt:'2026-10-29T12:00:00Z'}]})),null);
  assert.ok(registrationPlayer(member({status:'INVITED',invitations:[{seasonId:scope.seasonId,sentAt:'2025-12-29T12:00:00Z'}]})));
  assert.equal(registrationPlayer(member({status:'INACTIVE'})),null);
  assert.equal(registrationPlayer(member()).latestInvite,'2026-10-02T12:00:00.000Z');
  assert.throws(()=>registrationPlayer(member({invitations:undefined})),/coverage/);
});

test('current-season payment only; CASH does not imply paid; precise known and unknown actions',()=>{
  const p=registrationPlayer(member({registration:{seasonId:scope.seasonId,acceptedByPlayer:false,paymentMethod:'CASH',paymentStatus:'UNPAID',status:'WAITING'}}));
  assert.equal(p.paid,false);assert.equal(p.accepted,false);assert.equal(p.confirmed,false);assert.equal(p.ok,false);
  assert.match(p.actions.join(' '),/přijmout podmínky/);assert.match(p.actions.join(' '),/Platí manažer/);
  assert.equal(registrationPlayer(member()).ok,true);
  const old=registrationPlayer(member({registration:{...member().registration,seasonId:oldSeason}}));
  assert.equal(old.paid,null);assert.equal(old.accepted,null);assert.equal(old.confirmed,null);
  const unknown=registrationPlayer(member({registration:{seasonId:scope.seasonId,paymentStatus:'OTHER'}}));
  assert.equal(unknown.paid,null);assert.match(unknown.actions.join(' '),/ověřený stav úhrady/);
});

test('strict scope, complete invitation coverage, duplicate membership and whitelist',()=>{
  for(const patch of [{organizationId:otherTeamId},{competitionId:otherTeamId},{seasonId:oldSeason},{complete:false},{schemaVersion:2}])assert.throws(()=>normalizeRegistrationPages([page(patch)]));
  assert.throws(()=>normalizeRegistrationPages([page(),page()]),/Duplicate/);
  const input=member({privateNote:'PRIVATE-NOTE',password:'PRIVATE-PASSWORD',photoUrl:'https://attacker.invalid/pixel'});
  const result=registrationPlayer(input);assert.equal(result.photoUrl,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
  assert.equal(registrationPlayer(member({photoUrl:'https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/player.png'})).photoUrl.includes('player.png'),true);
});

test('reader refuses unverified endpoints, pins credentials, forbids redirects and follows complete bounded cursors',async()=>{
  let calls=0;
  await assert.rejects(readRegistrationTeams({env:{},fetchImpl:()=>{calls++;}}),/source_not_verified/);assert.equal(calls,0);
  const config={HMS_PHM_REGISTRATIONS_VERIFIED:'true',HMS_PHM_REGISTRATIONS_URL:'https://reader.invalid/registrations',HMS_PHM_REGISTRATIONS_API_TOKEN:'private-source-token'};
  await assert.rejects(readRegistrationTeams({env:{...config,HMS_PHM_REGISTRATIONS_API_TOKEN:undefined,HMS_API_TOKEN:'do-not-forward'},fetchImpl:()=>{calls++;}}),/source_configuration/);assert.equal(calls,0);
  const result=await readRegistrationTeams({env:config,fetchImpl:async(url,options)=>{
    calls++;assert.equal(options.redirect,'error');assert.equal(url.searchParams.get('seasonId'),scope.seasonId);assert.equal(options.headers.authorization,'Bearer private-source-token');
    return Response.json(calls===1?page({nextCursor:'second'}):page({teams:[{teamId:otherTeamId,name:'B',members:[]}]}));
  }});assert.equal(result.length,2);
  await assert.rejects(readRegistrationTeams({env:config,fetchImpl:async()=>Response.json(page({nextCursor:'same'}))}),/source_integrity/);
  await assert.rejects(readRegistrationTeams({env:config,fetchImpl:async()=>Response.json(page({nextCursor:undefined}))}),/source_integrity/);
  await assert.rejects(readRegistrationTeams({env:config,fetchImpl:async()=>new Response('redirect',{status:302})}),/source_unavailable/);
});

test('anonymous admin routes never read player source; methods, CSRF and scope inputs are enforced',async()=>{
  let reads=0;const handler=createRegistrationControlHandler({env,store:memoryStore(),read:async()=>{reads++;return teams();}});
  for(const action of ['catalog','admin-team','rotate','revoke']){const r=response();await handler(request(action,{query:{action,teamId}}),r);assert.equal(r.code,401);}
  assert.equal(reads,0);
  for(const origin of [undefined,'https://attacker.invalid']){const r=response();await handler(request('login',{headers:{...bearer,origin}}),r);assert.equal(r.code,403);}
  const method=response();await handler(request('rotate',{method:'GET',headers:bearer}),method);assert.equal(method.code,405);
  const scopeChange=response();await handler(request('team',{query:{action:'team',teamId}}),scopeChange);assert.equal(scopeChange.code,400);
  const queryToken=response();await handler(request('team',{query:{action:'team',token:'private'}}),queryToken);assert.equal(queryToken.code,400);
});

test('admin login follows existing signed HttpOnly session pattern and does not expose secrets',async()=>{
  const handler=createRegistrationControlHandler({env,store:memoryStore(),read:async()=>teams()});
  const login=response();await handler(request('login',{headers:bearer}),login);assert.equal(login.code,200);
  assert.match(login.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.doesNotMatch(JSON.stringify(login),/test-admin-value/);
  const cookie=login.headers['set-cookie'].split(';')[0];const r=response();await handler(request('catalog',{headers:{cookie}}),r);assert.equal(r.code,200);
  assert.doesNotMatch(JSON.stringify(r.body),/test@example|OTHER-TEAM|token_hash/);
  const forged=response();await handler(request('catalog',{headers:{cookie:cookie+'forged'}}),forged);assert.equal(forged.code,401);
  const expired=response();await handler(request('catalog',{headers:{cookie:sessionCookie({code:'PHM_REGISTRATIONS'},env.HMS_PHM_TOOLS_ADMIN_SECRET,Date.now()-9*3600000)}}),expired);assert.equal(expired.code,401);
});

test('per-team link exchange, IDOR defense, rotation and revocation invalidate existing sessions',async()=>{
  const store=memoryStore();let reads=0;
  const handler=createRegistrationControlHandler({env,store,read:async()=>{reads++;return teams();}});
  const created=response();await handler(request('rotate',{headers:bearer,query:{action:'rotate',teamId}}),created);assert.equal(created.code,201);
  const token=created.body.path.split('#')[1];assert.equal(token.length,43);
  const exchange=response();await handler(request('exchange',{headers:{...bearer,authorization:'Bearer '+token}}),exchange);assert.equal(exchange.code,200);
  const cookie=exchange.headers['set-cookie'].split(';')[0];
  const team=response();await handler(request('team',{headers:{cookie}}),team);assert.equal(team.code,200);assert.equal(team.body.team.teamId,teamId);
  assert.doesNotMatch(JSON.stringify(team.body),/OTHER-TEAM|token_hash|test-admin-value/);
  for(const key of ['org','seasonId','competitionId','organizationId','teamId']){const r=response();await handler(request('team',{headers:{cookie},query:{action:'team',[key]:otherTeamId}}),r);assert.equal(r.code,400);}
  const invalid=response(),before=reads;await handler(request('team',{headers:{authorization:'Bearer '+'a'.repeat(43)}}),invalid);assert.equal(invalid.code,404);assert.equal(reads,before);
  const rotated=response();await handler(request('rotate',{headers:bearer,query:{action:'rotate',teamId}}),rotated);assert.notEqual(rotated.body.path,created.body.path);
  const stale=response();await handler(request('team',{headers:{cookie}}),stale);assert.equal(stale.code,404);
  const newToken=rotated.body.path.split('#')[1];const revoke=response();await handler(request('revoke',{headers:bearer,query:{action:'revoke',teamId}}),revoke);assert.equal(revoke.code,200);
  const revoked=response();await handler(request('team',{headers:{authorization:'Bearer '+newToken}}),revoked);assert.equal(revoked.code,404);
});

test('revocation stays available during upstream outage, failures never log or expose payloads',async()=>{
  const store=memoryStore();await store.rotate(scope,teamId);
  const handler=createRegistrationControlHandler({env,store,read:async()=>{throw Error('PRIVATE SQL CONTACT SECRET');}});
  const catalog=response();await handler(request('catalog',{headers:bearer}),catalog);assert.equal(catalog.code,200);assert.equal(catalog.body.sourceReady,false);
  const revoke=response();await handler(request('revoke',{headers:bearer,query:{action:'revoke',teamId}}),revoke);assert.equal(revoke.code,200);
  const data=response();await handler(request('admin-team',{headers:bearer,query:{action:'admin-team',teamId}}),data);assert.equal(data.code,503);assert.doesNotMatch(JSON.stringify(data),/PRIVATE SQL CONTACT SECRET/);
  assert.equal(data.headers['cache-control'],'private, no-store');assert.equal(data.headers['referrer-policy'],'no-referrer');
});

test('durable rate limiting blocks guesses before token resolution',async()=>{
  let resolved=false;
  const handler=createRegistrationControlHandler({env,store:{rate:async()=>false,resolve:async()=>{resolved=true;}}});
  const r=response();await handler(request('exchange',{headers:{...bearer,authorization:'Bearer '+'a'.repeat(43)}}),r);assert.equal(r.code,429);assert.equal(resolved,false);
});

test('SQL stores only digests, parameterizes scope and checks live revocation and expiry',async()=>{
  const queries=[];const sql={async query(text,values=[]){queries.push({text,values});return [{team_id:teamId,revision:1,attempts:1}];}};
  const store=registrationLinkStore({sql});const result=await store.rotate(scope,teamId);
  assert.equal(result.token.length,43);assert.ok(queries.some(q=>q.values.includes(tokenHash(result.token))));
  assert.ok(!JSON.stringify(queries).includes(result.token));
  await store.resolve(result.token,scope);
  assert.match(queries.at(-1).text,/revoked_at is null and expires_at>now\(\)/);
  assert.deepEqual(queries.at(-1).values.slice(0,3),[scope.organizationId,scope.competitionId,scope.seasonId]);
  const before=queries.length;assert.equal(await store.resolve('invalid',scope),null);assert.equal(queries.length,before);
  await store.revoke(scope,teamId);assert.match(queries.at(-1).text,/revoked_at=now\(\)/);
});

test('map contains internal management only; Vercel dispatch uses existing function and privacy headers',async()=>{
  const app=appsForOrganization('phm').find(a=>a.id==='registrations');assert.equal(app.links.manage,'/control/apps/registrations');assert.equal(app.links.public,undefined);
  assert.ok(!appsForOrganization('euchl').find(a=>a.id==='registrations').links.open);
  const vercel=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  for(const rule of vercel.headers)for(const header of rule.headers){assert.equal(typeof header.key,'string');assert.equal(typeof header.value,'string');}
  assert.ok(vercel.rewrites.some(r=>r.source==='/api/registrations'&&r.destination==='/api/game-summary?view=registrations'));
  const dispatch=await readFile(new URL('../api/game-summary.js',import.meta.url),'utf8');assert.match(dispatch,/view==='registrations'\?registrations/);
  assert.ok(vercel.headers.some(r=>r.source==='/control/apps/registrations'&&r.headers.some(h=>h.key==='Content-Security-Policy'&&h.value.includes("frame-ancestors 'none'"))));
});

test('real local HTTP routes serve private shells and refuse anonymous data and parameter override',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    for(const path of ['/control/apps/registrations','/registrations/team','/registrations/admin','/registrations/app.js','/registrations/app.css']){
      const r=await fetch(base+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');
      const body=await r.text();assert.doesNotMatch(body,/test@example|OTHER-TEAM|test-admin-value/);
    }
    const r=await fetch(base+'/api/registrations?action=catalog');assert.ok([401,503].includes(r.status));
    const scopeChange=await fetch(base+'/api/game-summary?view=registrations&action=team&teamId='+teamId);assert.equal(scopeChange.status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
