import test from 'node:test';
import assert from 'node:assert/strict';
import {carouselItems,carouselCard} from '../public/insights-carousel.js';
const id='11111111-1111-4111-8111-111111111111';
const item={id:'highlight',gameId:id,date:'2026-10-28',type:'HATTRICK',importance:92,title:'Hattrick',text:'Jan dal 3 góly.',player:'Jan Novák',team:'Guardians',homeTeam:'Guardians',awayTeam:'Lions',homeScore:5,awayScore:7,facts:{goals:3},group:'Division One'};
test('Home carousel uses only the selected organization and the newest eight public selection items',()=>{
 const rows=Array.from({length:12},(_,i)=>({...item,date:`2026-10-${String(i+1).padStart(2,'0')}`,id:String(i)}));
 assert.throws(()=>carouselItems({organization:'PHM',items:rows},'euchl'));
 const result=carouselItems({organization:'EUCHL',items:[{...item,gameId:'javascript:alert(1)'},...rows]},'euchl');
 assert.equal(result.length,8);assert.equal(result[0].date,'2026-10-12');assert.equal(result.at(-1).date,'2026-10-05');assert.equal(rows[0].date,'2026-10-01');
});
test('large cards share Insights translations, approved photos and exact fixture report links',()=>{
 const image='https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/roy_[size]';
 const html=carouselCard({...item,playerImageUrl:image},'en',0,8);
 assert.match(html,/scored 3 goals/);assert.match(html,/roy_cropped_md/);assert.match(html,new RegExp('/game-center/'+id+'/public\\?lang=en'));assert.match(html,/1 \/ 8/);assert.doesNotMatch(html,/Jan dal/);
 const cs=carouselCard(item,'cs',1,8);assert.match(cs,/Report zápasu/);assert.match(cs,/Jan dal 3 góly/);
});
test('cards escape sporting labels and reject arbitrary photo hosts while providing a logo/initials fallback',()=>{
 const html=carouselCard({...item,player:'<script>bad()</script>',text:'<img onerror="bad()">',playerImageUrl:'https://evil.test/photo',teamLogoUrl:'javascript:alert(1)'},'cs',0,1);
 assert.doesNotMatch(html,/<script>|<img onerror|evil\.test|javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/ic-initials/);
});
