import {publicRead} from './season-games.js';
import {fetchGames,hmsConfigFromEnv} from '../hms/client.js';
import {flickrAlbum,youtubeVideo} from '../../public/game-report-media.js';
const cache=new Map(),pending=new Map();
// Optional metadata is read for the visible batch only, never on hover.
export async function stripMedia(context,items,options={}){
 if(!items.length)return new Map();
 const key=[context.organization.id,context.scope.seasonId,...items.map(g=>g.id)].join(':'),cacheable=!options.fetchImpl&&!options.fetchGames;
 if(cacheable&&cache.get(key)?.until>Date.now())return cache.get(key).value;
 if(cacheable&&pending.has(key))return pending.get(key);
 if(pending.size>=8)return new Map();
 const task=(async()=>{
  const result=new Map(items.map(g=>[g.id,{albumUrl:null,youtubeUrl:null}]));
  // The organization-scoped API supplies Flickr; public multimedia supplies video.
  if(context.organization.token||options.fetchGames)try{
   const rows=await(options.fetchGames??fetchGames)({seasonId:context.scope.seasonId,startDate:items[0].date},{config:{...hmsConfigFromEnv({...options.env,HMS_API_TOKEN:context.organization.token??'test'}),timeoutMs:5000,retries:0}});
   if(Array.isArray(rows)&&rows.length<=2000)for(const r of rows){const game=items.find(g=>g.id===r.gameId?.toLowerCase());
    if(!game||r.organizationId?.toLowerCase()!==context.organization.id.toLowerCase()||r.seasonId?.toLowerCase()!==context.scope.seasonId||r.startDate!==game.date||r.HomeTeam?.teamId?.toLowerCase()!==game.home.id||r.AwayTeam?.teamId?.toLowerCase()!==game.away.id)continue;
    result.set(game.id,{albumUrl:flickrAlbum(r.flickrAlbum),youtubeUrl:youtubeVideo(r.youtubeVideoUrl)});
   }
  }catch{/* Optional metadata never blocks the schedule. */}
  let cursor=0;await Promise.all(Array.from({length:Math.min(3,items.length)},async()=>{while(cursor<items.length){const game=items[cursor++];try{
   const raw=await publicRead('gameMultimedia',{gameId:game.id},{...options,maxBytes:256*1024,timeoutMs:1500});
   if(raw?.gameId&&raw.gameId.toLowerCase()!==game.id)continue;
   const current=result.get(game.id);result.set(game.id,{albumUrl:current.albumUrl??flickrAlbum(raw?.albumUrl)??flickrAlbum(raw?.flickrAlbum),youtubeUrl:youtubeVideo(raw?.youtubeVideoUrl)??current.youtubeUrl});
  }catch{/* Missing media stays hidden. */}}}));
  if(cacheable){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{value:result,until:Date.now()+120000});}return result;
 })();
 if(cacheable)pending.set(key,task);try{return await task;}finally{if(cacheable)pending.delete(key);}
}
