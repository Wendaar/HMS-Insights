import {fetchGameDetail,fetchGames,hmsConfigFromEnv} from '../src/hms/client.js';
import {gameRows} from '../src/app/backfill-finished-games.js';
export async function checkArchiveHmsFields(env=process.env){
 const options={config:{...hmsConfigFromEnv(env),timeoutMs:10000,retries:0}};
 const game=await fetchGameDetail('F62DABCB-98CA-11F1-8BDF-EF2495D048F3',options);
 console.log('PHOTO_ARCHIVE_HMS_FIELDS '+JSON.stringify({keys:Object.keys(game),media:Object.fromEntries(Object.entries(game).filter(([k])=>/flickr|album/i.test(k))),teamIds:[game.homeTeamId,game.awayTeamId],seasonId:game.seasonId}));
 for(const skip of [0,20,80,100]){const rows=gameRows(await fetchGames({from:'2026-10-01',to:'2026-11-10',status:'ALL',limit:20,skip},options));console.log('PHOTO_ARCHIVE_HMS_RANGE '+JSON.stringify({skip,count:rows.length,first:rows[0]?.startDate,last:rows.at(-1)?.startDate,sample:rows.slice(0,1).map(g=>({keys:Object.keys(g),gameId:g.gameId,startDate:g.startDate,seasonId:g.seasonId,media:Object.fromEntries(Object.entries(g).filter(([k])=>/flickr|album/i.test(k)))}))}));}
}
