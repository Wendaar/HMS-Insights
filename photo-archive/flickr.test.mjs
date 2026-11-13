import test from 'node:test';
import assert from 'node:assert/strict';
import {albumFromUrl,resolveAlbum,fetchAlbum} from './flickr.mjs';
const canonical='https://www.flickr.com/photos/153512269@N03/albums/72177720336372497/';
test('canonical albums and legacy sets preserve large IDs as strings without requests',async()=>{
  const noFetch=()=>{throw Error('network unexpected');};
  assert.equal((await resolveAlbum(canonical,{fetchImpl:noFetch})).photosetId,'72177720336372497');
  assert.equal(albumFromUrl(canonical.replace('/albums/','/sets/')).photosetId,'72177720336372497');
});
test('all four live-observed Flickr redirects resolve (recorded 2026-11-08)',async()=>{
  const pairs=[['aHBqjD8KrT','72177720336372497'],['aHBqjD8QEj','72177720336390038'],['aHBqjD8UFS','72177720336403584'],['aHBqjD8UFG','72177720336403574']];
  for(const [token,id] of pairs) {
    const result=await resolveAlbum('https://flic.kr/s/'+token,{fetchImpl:async(url,init)=>{
      assert.equal(init.redirect,'manual');
      return new Response(null,{status:302,headers:{location:`https://www.flickr.com/photos/153512269@N03/sets/${id}/`}});
    }});
    assert.equal(result.photosetId,id);
    assert.equal(result.resolution,'redirect');
  }
});
test('guest landing uses canonical metadata, ignoring unrelated album links',async()=>{
  let count=0;
  const result=await resolveAlbum('https://flic.kr/s/example',{fetchImpl:async()=>++count===1?
    new Response(null,{status:302,headers:{location:'https://www.flickr.com/gp/owner/token'}}):
    new Response(`<a href="${canonical.replace('497','498')}">other</a><link href='${canonical}' rel='canonical'><meta property="og:url" content="${canonical.replace('/albums/','/sets/')}">`)});
  assert.equal(result.photosetId,'72177720336372497');
});
test('rejects untrusted URLs, redirects, loops, missing and conflicting metadata',async()=>{
  for(const url of ['http://flic.kr/s/x','https://flickr.com.evil.test/s/x','https://user@flic.kr/s/x','https://flic.kr:444/s/x','https://flic.kr/p/x']) {
    await assert.rejects(resolveAlbum(url));
  }
  await assert.rejects(resolveAlbum('https://flic.kr/s/x',{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.test/'}})}),/HTTPS Flickr/);
  await assert.rejects(resolveAlbum('https://flic.kr/s/x',{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'/s/x'}})}),/Too many/);
  await assert.rejects(resolveAlbum('https://flic.kr/s/x',{fetchImpl:async()=>new Response('login')}),/no numeric/);
  await assert.rejects(resolveAlbum('https://flic.kr/s/x',{fetchImpl:async()=>new Response(`<link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical.replace('497','498')}">`)}),/Conflicting/);
});
test('API pagination respects limit, verifies photoset identity and never forwards a key on redirects',async()=>{
  let calls=0;
  const album=await fetchAlbum(canonical,{limit:3,env:{FLICKR_API_KEY:'fake'},fetchImpl:async(url,init)=>{
    calls++; assert.equal(init.redirect,'error'); assert.equal(url.searchParams.get('page'),String(calls));
    return Response.json({stat:'ok',photoset:{id:'72177720336372497',total:'5',photo:Array.from({length:2},(_,i)=>({id:String((calls-1)*2+i),url_b:'https://live.staticflickr.com/1/x.jpg'}))}});
  }});
  assert.equal(calls,2);assert.equal(album.photos.length,3);assert.equal(album.total,5);
  await assert.rejects(fetchAlbum(canonical,{env:{FLICKR_API_KEY:'fake'},fetchImpl:async()=>Response.json({stat:'fail',code:100,message:'secret'})}),/code 100/);
  await assert.rejects(fetchAlbum(canonical,{env:{FLICKR_API_KEY:'fake'},fetchImpl:async()=>Response.json({stat:'ok',photoset:{id:'wrong',total:1,photo:[]}})}),/Invalid/);
});
