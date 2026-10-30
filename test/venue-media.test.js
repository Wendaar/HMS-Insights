import test from 'node:test';
import assert from 'node:assert/strict';
import {flickrPhoto,flickrImage,venueBackground} from '../public/venue-media.js';
import {resolveVenueBackground} from '../src/app/venue-media.js';
import {hmsMediaContext} from '../src/hms/media-context.js';
import {applyPublicMedia} from '../src/app/media-engine.js';
import {studioAssetUrl} from '../src/web/studio-image-handler.js';
const photo='https://www.flickr.com/photos/153512269@N03/54178412345/',image='https://live.staticflickr.com/1234/54178412345_abcdef_b.jpg',logo='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/venue-logo.png';

test('HMS editor igBgImageUrl accepts the supplied dateposted photo URL and resolves its canonical photo',async()=>{
 const source='https://www.flickr.com/photos/153512269@N03/54170419316/in/dateposted/',canonical='https://www.flickr.com/photos/153512269@N03/54170419316/';
 assert.equal(flickrPhoto(source),canonical);assert.equal(hmsMediaContext({Venue:{igBgImageUrl:source}}).venueBackgroundUrl,canonical);
 let requested;assert.equal(await resolveVenueBackground(source,{fetchImpl:async url=>{requested=url;return Response.json({type:'photo',url:image});}}),image);assert.equal(requested.searchParams.get('url'),canonical);
 for(const suffix of ['in/dateposted/extra/','in/anything/','in/dateposted/?secret=x'])assert.equal(flickrPhoto(canonical+suffix),null);
});
test('venue media preserves configured photos/logos, rejects non-public sources and only accepts a Flickr photo page',()=>{
 assert.equal(flickrPhoto(photo),photo);assert.equal(flickrImage(image),image);assert.equal(venueBackground('https://cdn.example.com/arena.jpg'),'https://cdn.example.com/arena.jpg');
 for(const value of ['http://localhost/a.jpg','https://127.0.0.1/a.jpg','https://local.internal/a.png','javascript:alert(1)',photo+'?secret=x','https://www.flickr.com/photos/account/albums/123','https://live.staticflickr.com.attacker.example/1234/123_a_b.jpg']){assert.equal(flickrPhoto(value),null);assert.equal(flickrImage(value),null);}
 assert.equal(studioAssetUrl(image).href,image);assert.throws(()=>studioAssetUrl('https://live.staticflickr.com/redirect'));
 const context=hmsMediaContext({Venue:{name:'SPM Aréna',logoUrl:logo,backgroundImageUrl:photo}});assert.equal(context.venueLogoUrl,logo);assert.equal(context.venueBackgroundUrl,photo);
});
test('Flickr resolution uses a fixed credential-free endpoint and validates its returned raster host',async()=>{
 let request;const result=await resolveVenueBackground(photo,{fetchImpl:async(url,opts)=>{request={url,opts};return Response.json({type:'photo',url:image});}});assert.equal(result,image);assert.equal(request.url.hostname,'www.flickr.com');assert.equal(request.url.searchParams.get('url'),photo);assert.equal(request.opts.headers.authorization,undefined);assert.equal(request.opts.redirect,'manual');
 for(const payload of [{type:'photo',url:'https://evil.example/a.jpg'},{type:'video',url:image}])assert.equal(await resolveVenueBackground(photo,{fetchImpl:async()=>Response.json(payload)}),null);
 assert.equal(await resolveVenueBackground(photo,{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})}),null);
});
test('optional public venue media must match both fixture teams/date and the venue name',()=>{
 const summary={home:{id:'home'},away:{id:'away'},playedOn:'2026-11-01',venue:'SPM Aréna',players:[],goalies:[]},metadata={HomeTeam:{teamId:'home'},AwayTeam:{teamId:'away'},startDate:'2026-11-01',Venue:{name:'Other venue',logoUrl:logo,backgroundImageUrl:photo}};
 applyPublicMedia(summary,metadata);assert.equal(summary.venueLogoUrl,undefined);metadata.Venue.name='SPM Aréna';applyPublicMedia(summary,metadata);assert.equal(summary.venueLogoUrl,logo);assert.equal(summary.venueBackgroundUrl,photo);
});
