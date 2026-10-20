import test from 'node:test';
import assert from 'node:assert/strict';
import { sportingImage,flickrAlbum } from '../public/game-report-media.js';
import { buildGameSummary } from '../src/domain/game-summary.js';
import { renderHero,renderSpotlight } from '../src/web/game-report-showcase.js';
import { normalizeHmsGame } from '../src/hms/normalize.js';
import { gameEvents,lineup } from '../src/fixtures/zbraslav-kosti.js';
const image='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_TEST_[size]';
test('sporting media reject foreign hosts, embedded credentials, executable and signed URLs',()=>{
  assert.equal(sportingImage(image),image.replace('[size]','cropped_md'));
  for(const value of ['javascript:alert(1)','https://evil.example/photo.png','https://prod-hms-wootera.s3.eu-central-1.amazonaws.com.evil.example/x','https://secret@prod-hms-wootera.s3.eu-central-1.amazonaws.com/x',image+'?token=private','http://hockeymanagementsystem.s3.amazonaws.com/x'])assert.equal(sportingImage(value),null);
});
test('Flickr links only accept album formats, not arbitrary photo or script links',()=>{
  const album='https://www.flickr.com/photos/phmcup/albums/123456';
  assert.equal(flickrAlbum(album),album);assert.equal(flickrAlbum('https://flic.kr/s/abc123'),'https://flic.kr/s/abc123');
  for(const value of ['javascript:alert(1)','https://evil.example/albums/123','https://www.flickr.com/photos/phmcup/albums/123?secret=x','123'])assert.equal(flickrAlbum(value),null);
});
test('public summary selects stored sporting images and excludes raw media attributes',()=>{
  const s=buildGameSummary({game:{game_id:'g',home_team_id:'home',away_team_id:'away',home_score:1,away_score:0},teams:[{side:'HOME',team_logo_template_url:image}],players:[{player_id:'p',player_name:'Name',team_id:'home',goals:1,assists:0,pim:0,player_image_template_url:image,email:'private'}]});
  assert.equal(s.home.logoUrl,sportingImage(image));assert.equal(s.players[0].imageUrl,sportingImage(image));assert.doesNotMatch(JSON.stringify(s),/email|private|\[size\]/);
});
test('album survives a new import only for the requested game; labels stay escaped',()=>{
  const album='https://www.flickr.com/photos/phmcup/albums/123';
  assert.equal(normalizeHmsGame({...gameEvents,flickrAlbum:album},lineup).eventSnapshot.media.albumUrl,album);
  assert.equal(normalizeHmsGame(gameEvents,lineup,null,{gameId:'other',flickrAlbum:album}).eventSnapshot.media.albumUrl,null);
});
test('showcase uses actual team scoring leaders without claiming official game stars',()=>{
  const s={home:{id:'home',name:'Home <A>',score:1},away:{id:'away',name:'Away',score:2},status:'FINISHED',players:[{id:'p',teamId:'home',name:'<img src=x>',points:2,goals:1,assists:1,imageUrl:image}],goalies:[],timeline:{periodScores:[]},media:{albumUrl:'https://evil.example'}};
  assert.match(renderSpotlight(s),/&lt;img src=x&gt;/);assert.doesNotMatch(renderSpotlight(s),/official|Hvězda zápasu/);
  assert.doesNotMatch(renderHero(s),/evil.example|Fotogalerie/);assert.match(renderHero(s),/Home &lt;A&gt;/);
});
