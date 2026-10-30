import {isGameId} from '../domain/game-summary.js';
import {publicOutputUrl} from '../../public/public-output.js';
export function matchLinks(org,game){
 if(!/^[a-z][a-z0-9-]{1,39}$/.test(org)||!isGameId(game.gameId))throw new TypeError('Invalid fixture link');
 const path=`/m/${org}/${game.gameId.toLowerCase()}`;
 const scoped=[game.seasonId,game.groupId,game.phaseId,game.home?.id,game.away?.id].every(isGameId);
 return {game:publicOutputUrl(path),compare:scoped?publicOutputUrl(path+'/analysis'):null,report:publicOutputUrl('/game-center/'+game.gameId)};
}
export function comparisonDestination(org,game,language='cs'){
 const ids=[game.seasonId,game.groupId,game.phaseId,game.home?.id,game.away?.id];
 if(!ids.every(isGameId)||ids[3].toLowerCase()===ids[4].toLowerCase())throw new TypeError('Comparison scope unavailable');
 const q=new URLSearchParams({lang:language==='en'?'en':'cs',seasonId:ids[0],groupId:ids[1],phaseId:ids[2],left:ids[3],right:ids[4]});
 return `/team-comparison/${org}?${q}`;
}
