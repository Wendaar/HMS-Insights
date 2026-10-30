import {isGameId} from '../domain/game-summary.js';
import {publicOutputUrl,PUBLIC_ORIGIN} from '../../public/public-output.js';
// New pregame routes must stay on the preview that actually contains them.
// Only server-owned Vercel deployment metadata can override the public origin.
function previewOrigin(env){
 const host=env.VERCEL_BRANCH_URL||env.VERCEL_URL;
 return env.VERCEL_ENV==='preview'&&/^[a-z0-9-]+\.vercel\.app$/i.test(host??'')?`https://${host}`:PUBLIC_ORIGIN;
}
export function matchLinks(org,game,{env=process.env}={}){
 if(!/^[a-z][a-z0-9-]{1,39}$/.test(org)||!isGameId(game.gameId))throw new TypeError('Invalid fixture link');
 const path=`/m/${org}/${game.gameId.toLowerCase()}`;
 const scoped=[game.seasonId,game.groupId,game.phaseId,game.home?.id,game.away?.id].every(isGameId)&&game.home.id.toLowerCase()!==game.away.id.toLowerCase();
 return {game:new URL(path,previewOrigin(env)).href,compare:scoped?publicOutputUrl(comparisonDestination(org,game)):null,report:publicOutputUrl('/game-center/'+game.gameId)};
}
export function comparisonDestination(org,game,language='cs'){
 const ids=[game.seasonId,game.groupId,game.phaseId,game.home?.id,game.away?.id];
 if(!ids.every(isGameId)||ids[3].toLowerCase()===ids[4].toLowerCase())throw new TypeError('Comparison scope unavailable');
 const q=new URLSearchParams({lang:language==='en'?'en':'cs',seasonId:ids[0],groupId:ids[1],phaseId:ids[2],left:ids[3],right:ids[4]});
 return `/team-comparison/${org}?${q}`;
}
