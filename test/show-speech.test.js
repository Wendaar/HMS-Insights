import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowSpeechHandler,speechSsml} from '../src/web/show-speech-handler.js';
import {matchingVoices,announcementText} from '../public/show-control/speech.js';
import {server} from '../src/server.js';
const env={HMS_PHM_TTS_ENABLED:'true',HMS_PHM_OPERATIONS_SECRET:'test-code',AZURE_SPEECH_KEY:'private-provider-key',AZURE_SPEECH_REGION:'westeurope'};
const req=(body={text:'Hello & <test>.',language:'en',rate:.9,pauseMs:250},extra={})=>({method:'POST',query:{org:'PHM'},headers:{authorization:'Bearer test-code','content-type':'application/json',host:'hms.test',origin:'https://hms.test'},body,...extra});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;},send(v){this.body=v;}});
test('server speech requires org opt-in and same-org operator code, rejecting foreign origin and invalid input',async()=>{
 let calls=0;const h=createShowSpeechHandler({env,fetchImpl:async()=>{calls++;throw Error();}});
 for(const [request,code]of [[req(null,{method:'GET'}),200],[req(undefined,{headers:{}}),401],[req(undefined,{query:{org:'EUCHL'}}),401],[req(undefined,{headers:{...req().headers,origin:'https://foreign.test'}}),403],[req({...req().body,language:'ru'}),400],[req({...req().body,text:'x'.repeat(2401)}),400],[req({...req().body,rate:20}),400]]){const r=res();await h(request,r);assert.equal(r.code,code);assert.doesNotMatch(JSON.stringify(r.body),/private-provider|test-code/);}
 assert.equal(calls,0);const r=res();await createShowSpeechHandler({env:{...env,HMS_PHM_TTS_ENABLED:'false'}})(req(),r);assert.equal(r.code,503);
});
test('Azure receives escaped SSML, bounded parameters, server key only; repeats use scoped cache',async()=>{
 let calls=0;const h=createShowSpeechHandler({env,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');assert.equal(options.headers['Ocp-Apim-Subscription-Key'],env.AZURE_SPEECH_KEY);assert.match(options.body,/&amp; &lt;test&gt;/);assert.match(options.body,/en-US-GuyNeural/);assert.match(options.body,/rate="-10%"/);return {ok:true,arrayBuffer:async()=>Buffer.from('test audio fixture')};}});
 const first=res(),second=res();await h(req(),first);await h(req(),second);assert.equal(calls,1);assert.equal(first.headers['content-type'],'audio/mpeg');assert.deepEqual(first.body,second.body);
 const bad=res();await h(req(undefined,{headers:{}}),bad);assert.equal(bad.code,401);
 assert.match(speechSsml({text:'Číslo osm, Kyle.',language:'cs',rate:.9,pauseMs:250},'cs-CZ-AntoninNeural'),/<break time="250ms"\/>.*<break time="375ms"\/>/);
});
test('provider failures are safe, rate limited and do not leak responses or credentials',async()=>{
 let calls=0;const h=createShowSpeechHandler({env,fetchImpl:async()=>{calls++;return {ok:false,text:async()=>env.AZURE_SPEECH_KEY};}});
 for(let i=0;i<10;i++){const r=res();await h(req(),r);assert.equal(r.code,503);assert.doesNotMatch(JSON.stringify(r.body),/private-provider-key/);}const r=res();await h(req(),r);assert.equal(r.code,429);assert.equal(calls,10);
});
test('voice matching handles Android locale spelling and English never falls back to reading Czech LIVE text',()=>{
 const list=[{lang:'cs_CZ'},{lang:'en-GB'},{lang:'de-DE'}];assert.equal(matchingVoices(list,'cs').length,1);assert.equal(matchingVoices(list,'en').length,1);assert.equal(announcementText({text:'Česky'},'en'),null);assert.equal(announcementText({text:'Custom English',manual:true},'en'),'Custom English');
});
test('local speech route reports unconfigured service honestly and rejects unauthenticated generation',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const root='http://127.0.0.1:'+server.address().port;const r=await fetch(root+'/api/show-speech?org=PHM');assert.equal(r.status,200);assert.equal((await r.json()).configured,false);assert.equal((await fetch(root+'/api/show-speech?org=PHM',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);}finally{await new Promise(r=>server.close(r));}
});
