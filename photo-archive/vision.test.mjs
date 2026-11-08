import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePhoto,validateObservations} from './vision.mjs';
const env={OPENAI_API_KEY:'fake-secret',PHOTO_VISION_MODEL:'fixture-model'};
const photo='https://live.staticflickr.com/1/example_b.jpg';
const observation={jerseyNumber:'88',confidence:0.95,evidence:'Player on left; back number fully visible',jerseyDescription:'blue jersey'};
const completed=(data)=>({id:'fixture-response',model:'fixture-model',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
test('vision request uses high-detail image, strict schema, no roster, no storage; multiple players preserved',async()=>{
  const result=await analyzePhoto(photo,{env,fetchImpl:async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
    const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.equal(body.input[0].content[1].image_url,photo);assert.equal(body.input[0].content[1].detail,'high');
    return Response.json(completed({observations:[observation,{...observation,jerseyNumber:'17',confidence:0.4,teamId:'model-invented'}]}));
  }});
  assert.equal(result.observations.length,2);assert.equal(result.observations[0].jerseyNumber,'88');
  assert.equal(result.observations[1].jerseyNumber,null);assert.equal(result.observations[1].teamId,null);
});
test('no players is valid; malformed numbers and confidence never reach matcher',()=>{
  assert.deepEqual(validateObservations({observations:[]}),[]);
  for(const o of [{...observation,jerseyNumber:'8?'},{...observation,confidence:2},{...observation,confidence:'0.9'},null]) {
    assert.throws(()=>validateObservations({observations:[o]}),/Invalid/);
  }
});
test('missing configuration and non-Flickr images fail before network',async()=>{
  await assert.rejects(analyzePhoto(photo,{env:{}}),/OPENAI_API_KEY/);
  await assert.rejects(analyzePhoto(photo,{env:{OPENAI_API_KEY:'x'}}),/PHOTO_VISION_MODEL/);
  await assert.rejects(analyzePhoto('https://localhost/x',{env}),/Flickr image/);
});
test('HTTP errors, incomplete output, refusal and malformed output fail closed',async()=>{
  for(const [response,pattern] of [
    [new Response('secret',{status:401}),/HTTP 401/],
    [Response.json({status:'incomplete',output:[]}),/incomplete/],
    [Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}),/refused/],
    [Response.json({status:'completed',output:[]}),/not JSON/],
    [Response.json(completed({observations:[{...observation,jerseyNumber:'unknown'}]})),/Invalid/]
  ]) await assert.rejects(analyzePhoto(photo,{env,fetchImpl:async()=>response}),pattern);
});
