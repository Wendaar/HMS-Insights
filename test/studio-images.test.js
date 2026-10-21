import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAssetUrl,createStudioImageHandler} from '../src/web/studio-image-handler.js';
const host='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;},send(body){this.body=body;}});
test('HMS image bridge rejects SSRF destinations before any request',async()=>{
  let requests=0;const handler=createStudioImageHandler({fetchImpl:async()=>{requests++;throw new Error();}});
  for(const url of ['http://127.0.0.1/','https://169.254.169.254/latest/meta-data',host+':8080/x',host+'@localhost/x',host+'/x?secret=yes','https://prod-hms-wootera.s3.eu-central-1.amazonaws.com.attacker.com/x','https://example.com/x','file:///etc/passwd']){
    const r=response();await handler({method:'GET',query:{url}},r);assert.equal(r.code,400,url);
  }
  assert.equal(requests,0);assert.equal(studioAssetUrl(host+'/team_[size]').href,host+'/team_cropped_md');
});
test('image bridge copies bounded raster bytes without source CORS or credentials and refuses redirects/nonimages',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);let opts;
  const r=response();await createStudioImageHandler({fetchImpl:async(_url,o)=>{opts=o;return new Response(bytes,{headers:{'content-type':'application/octet-stream'}});}})({method:'GET',query:{url:host+'/logo'}},r);
  assert.equal(r.code,200);assert.deepEqual(r.body,bytes);assert.equal(r.headers['Content-Type'],'image/png');assert.equal(opts.redirect,'manual');assert.equal(opts.headers.authorization,undefined);
  for(const upstream of [new Response(null,{status:302,headers:{location:'http://169.254.169.254/'}}),new Response('<html>no</html>'),new Response(null,{headers:{'content-length':String(9*1024*1024)}})]){
    const r=response();await createStudioImageHandler({fetchImpl:async()=>upstream})({method:'GET',query:{url:host+'/logo'}},r);assert.equal(r.code,502);
  }
});
