import {organizationConfig} from '../app/organizations.js';
import {fetchGameDetail,fetchGameEvents,fetchGameLineup,fetchOrganization,fetchPublicGameMetadata,hmsConfigFromEnv} from '../hms/client.js';
import {broadcastMatch} from '../domain/broadcast-match.js';
import {browseMedia} from '../app/media-engine.js';
import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {hmsMediaContext} from '../hms/media-context.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const label=value=>typeof value==='string'?value.trim().slice(0,240):null;
const image=value=>sportingImage(value?.logoUrls?.md??value?.logoUrl);
function official(value){
  if(typeof value==='string')return label(value);
  if(Array.isArray(value))return value.map(official).filter(Boolean).join(', ').slice(0,240)||null;
  // Sporting display names only, never serialize arbitrary staff/contact objects.
  return value&&typeof value==='object'?label(value.name)||label([value.firstName,value.lastName].filter(v=>typeof v==='string').join(' ')):null;
}
export function enrichPregame(detail,metadata){
  const homeId=detail.homeTeamId??detail.HomeTeam?.teamId,awayId=detail.awayTeamId??detail.AwayTeam?.teamId;
  // Public /game has no org/game ID. Bind it to the already authenticated
  // fixture using both team UUIDs and the exact date before taking labels.
  if(!metadata||!same(homeId,metadata.HomeTeam?.teamId)||!same(awayId,metadata.AwayTeam?.teamId)||detail.startDate!==metadata.startDate)return detail;
  const team=side=>({teamId:side==='HomeTeam'?homeId:awayId,name:label(detail[side]?.name)||label(metadata[side]?.name),
    nick:label(detail[side]?.nick)||label(metadata[side]?.nick),logoUrl:image(detail[side])??image(metadata[side])});
  return {...detail,HomeTeam:team('HomeTeam'),AwayTeam:team('AwayTeam'),
    Venue:{...metadata.Venue,...detail.Venue,name:label(detail.Venue?.name)||label(metadata.Venue?.name)},
    Phase:{...metadata.Phase,...detail.Phase,Group:detail.Phase?.Group??metadata.Phase?.Group},
    referee:detail.referee??metadata.referee,timekeeper:detail.timekeeper??metadata.timekeeper};
}
export function pregameModel(detail,org,gameId,organization){
  if(!same(detail?.gameId,gameId)||!same(detail?.organizationId,org.id))throw new Error('Game/organization mismatch');
  const team=side=>{
    const t=detail[side];if(!isGameId(t?.teamId)||!label(t.name))throw new Error('Missing teams');
    return {id:t.teamId,name:label(t.name),shortName:label(t.nick),logoUrl:image(t)};
  };
  const brand=hmsMediaContext(detail);
  return {schemaVersion:1,org:org.code,gameId:detail.gameId,status:label(detail.status),date:/^\d{4}-\d{2}-\d{2}$/.test(detail.startDate??'')?detail.startDate:null,
    // HMS provides a local calendar date and time; do not shift them through UTC.
    time:/^\d{2}:\d{2}(?::\d{2})?$/.test(detail.startTime??'')?detail.startTime.slice(0,5):null,timeZone:'Europe/Prague',
    home:team('HomeTeam'),away:team('AwayTeam'),venue:label(detail.Venue?.name),competition:brand.competitionName,group:brand.groupName,phase:brand.phaseName,
    competitionLogoUrl:brand.competitionLogoUrl,organizationLogoUrl:same(organization?.organizationId,org.id)?image(organization):brand.organizationLogoUrl,
    referee:official(detail.referee),timekeeper:official(detail.timekeeper),source:'HMS API',readAt:new Date().toISOString()};
}
export function createBroadcastHandler(options={}){
  const cache=new Map(),pending=new Map();
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
    if(req.headers.origin==='https://wendaar.github.io'){res.setHeader('access-control-allow-origin','https://wendaar.github.io');res.setHeader('vary','Origin');}
    if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Pouze čtení.'});}
    const q=req.query??{},env=options.env??process.env;
    let stage='configuration';
    try{
      const org=organizationConfig(q.org??'PHM',env);if(!org.token)throw new Error('No scoped API token');
      if(!q.gameId){
        stage='schedule';
        const offset=Number(q.offset??0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new TypeError('Neplatná stránka.');
        const page=await (options.browse??browseMedia)({org:org.code,filter:q.filter??'Today',offset},{env,...options});
        return res.status(200).json({...page,org:org.code});
      }
      if(!isGameId(q.gameId))throw new TypeError('Neplatné gameId.');
      if(q.live!==undefined&&q.live!=='1')throw new TypeError('Invalid live mode');
      const key=org.code+':'+org.id.toLowerCase()+':'+q.gameId.toLowerCase()+':'+(q.live??'0'),now=Date.now();
      stage='game_data';
      if(cache.get(key)?.expires>now)return res.status(200).json(cache.get(key).data);
      if(!pending.has(key)){
        if(pending.size>=8)throw new Error('Busy');
        const task=(async()=>{
          const config={...hmsConfigFromEnv({...env,HMS_API_TOKEN:org.token}),timeoutMs:5000,retries:0};
          const detail=await (options.fetchDetail??fetchGameDetail)(q.gameId,{config});
          // Validate before optional organization branding and never use PHM data as fallback.
          if(!same(detail?.gameId,q.gameId)||!same(detail?.organizationId,org.id))throw new Error('Game/organization mismatch');
          const optional=await Promise.allSettled([
            (options.fetchMetadata??fetchPublicGameMetadata)(q.gameId),
            (options.fetchOrg??fetchOrganization)({config:{...config,timeoutMs:2500}}),
            q.live==='1'?(options.fetchEvents??fetchGameEvents)(q.gameId,{config}):null,
            q.live==='1'?(options.fetchLineup??fetchGameLineup)(q.gameId,{config}):null,
          ]);
          const [metadata,organization,events,lineup]=optional.map(r=>r.status==='fulfilled'?r.value:null);
          const data=pregameModel(enrichPregame(detail,metadata),org,q.gameId,organization);
          if(q.live==='1'){
            try{data.match=broadcastMatch(detail,events,lineup);}
            catch{data.match=null;}
          }
          cache.set(key,{data,expires:Date.now()+(q.live==='1'?10000:30000)});if(cache.size>100)cache.delete(cache.keys().next().value);return data;
        })();pending.set(key,task);task.finally(()=>pending.delete(key)).catch(()=>{});
      }
      return res.status(200).json(await pending.get(key));
    }catch(error){
      const invalid=error instanceof TypeError;
      return res.status(invalid?400:503).json({code:invalid?'invalid_request':stage,error:invalid?'Neplatná organizace, filtr nebo Game ID.':'Předzápasová data nejsou dostupná. Ověřte zápas a připojení vybrané organizace.'});
    }
  };
}
