import {fetchGameDetail,fetchGames,hmsConfigFromEnv} from '../src/hms/client.js';
import {gameRows} from '../src/app/backfill-finished-games.js';
import {createPhotoArchive} from '../src/app/photo-archive.js';
export async function checkArchiveHmsFields(env=process.env){
 const options={config:{...hmsConfigFromEnv(env),timeoutMs:10000,retries:0}};
 const game=await fetchGameDetail('F62DABCB-98CA-11F1-8BDF-EF2495D048F3',options);
 console.log('PHOTO_ARCHIVE_HMS_FIELDS '+JSON.stringify({keys:Object.keys(game),media:Object.fromEntries(Object.entries(game).filter(([k])=>/flickr|album/i.test(k))),teamIds:[game.homeTeamId,game.awayTeamId],seasonId:game.seasonId}));
 for(const skip of [0,20,80,100]){const rows=gameRows(await fetchGames({from:'2026-10-01',to:'2026-11-10',status:'ALL',limit:20,skip},options));console.log('PHOTO_ARCHIVE_HMS_RANGE '+JSON.stringify({skip,count:rows.length,first:rows[0]?.startDate,last:rows.at(-1)?.startDate,sample:rows.slice(0,1).map(g=>({keys:Object.keys(g),gameId:g.gameId,startDate:g.startDate,seasonId:g.seasonId,media:Object.fromEntries(Object.entries(g).filter(([k])=>/flickr|album/i.test(k)))}))}));}
}
export async function checkOlderArchive(env=process.env){
 const service=createPhotoArchive({env}),from='2026-10-01',to='2026-10-26';let offset=0,count=0,albums=0,ids=[];
 for(let page=0;page<20;page++){const result=await service.discover('PHM',{from,to,offset});count+=result.games;albums+=result.albums;ids.push(...result.gameIds);if(!result.hasMore)break;offset=result.nextOffset;}
 const catalog=(await service.catalog('PHM')).filter(g=>ids.some(id=>id.toLowerCase()===g.gameId.toLowerCase()));
 console.log('PHOTO_ARCHIVE_OLDER_CHECK '+JSON.stringify({from,to,games:count,albums,first:catalog.map(c=>c.playedOn).sort()[0],last:catalog.map(c=>c.playedOn).sort().at(-1),examples:catalog.filter(c=>c.albumUrl).slice(0,3).map(c=>({title:c.title,date:c.playedOn,albumUrl:c.albumUrl,field:c.albumFieldStatus})),modelCalls:0}));
}
