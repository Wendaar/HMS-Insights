import {fetchPublicGameMetadata} from '../hms/client.js';
import {sportingImage} from '../../public/game-report-media.js';
import {isGameId} from '../domain/game-summary.js';
const label=v=>typeof v==='string'?v.slice(0,160):null;
export async function publicPregame(gameId,options={}){
 if(!isGameId(gameId))return null;
 const data=await(options.fetchMetadata??fetchPublicGameMetadata)(gameId);
 if(!data||data.gameId&&(typeof data.gameId!=='string'||data.gameId.toLowerCase()!==gameId.toLowerCase())||!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate??'')||!label(data.HomeTeam?.name)||!label(data.AwayTeam?.name))return null;
 const group=data.Phase?.Group,competition=group?.Season?.Competition;
 const team=t=>({name:label(t.name),logoUrl:sportingImage(t.logoUrls?.md??t.logoUrl),preview:null});
 return {gameId,date:data.startDate,time:/^\d{2}:\d{2}/.test(data.startTime??'')?data.startTime.slice(0,5):null,status:label(data.status),venue:label(data.Venue?.name),competition:label(competition?.name),group:label(group?.name),phase:label(data.Phase?.name),home:team(data.HomeTeam),away:team(data.AwayTeam),links:{},branding:{venueLogoUrl:sportingImage(data.Venue?.logoUrls?.md??data.Venue?.logoUrl)}};
}
