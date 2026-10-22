import {organizationConfig} from '../app/organizations.js';
import {processFinishedGame} from '../app/process-finished-game.js';
import {backfillFinishedGamesPage} from '../app/backfill-finished-games.js';
import {hmsConfigFromEnv} from '../hms/client.js';
import {isGameId} from '../domain/game-summary.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {ensurePenaltyMinutesSchema} from '../infrastructure/postgres-repository.js';
import {timeWindow} from '../app/media-engine.js';

const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function createOrganizationImportHandler({batch=false,...options}={}){
  return async(request,response)=>{
    response.setHeader('cache-control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    if(request.method!=='POST'){response.setHeader('Allow','POST');return response.status(405).json({error:'Method not allowed'});}
    const env=options.env??process.env;let org;
    try{org=organizationConfig(request.query?.org??'PHM',env);}catch(error){return response.status(error instanceof TypeError?404:503).json({error:'Organizace není dostupná nebo nemá nastavené připojení.'});}
    if(!org.token||!org.webhookSecret)return response.status(503).json({error:'Import na tomto nasazení není nakonfigurovaný. Zkontrolujte serverové připojení vybrané organizace a proveďte nové nasazení.'});
    if(!hasBearerSecret(request,org.webhookSecret))return response.status(401).json({error:'Nesprávný signing secret vybrané organizace.'});
    let body;
    try{body=typeof request.body==='string'?JSON.parse(request.body):request.body;if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return response.status(400).json({error:'Neplatný JSON.'});}
    const scope={env,config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:org.token}),timeoutMs:6000,retries:0},organizationId:org.id,expectedOrganizationId:org.id};
    if(!batch&&!isGameId(body.gameId))return response.status(400).json({error:'Neplatné HMS Game ID.'});
    if(batch){
      const {from,to,seasonId}=body,skip=Number(body.skip??0),today=timeWindow('Today',options.now).from;
      const legacy=org.code==='PHM'&&to===undefined&&isGameId(seasonId);
      if(!validDate(from)||from>today||(!legacy&&(!validDate(to)||to<from||to>today||(Date.parse(to)-Date.parse(from))/86400000>30))||seasonId!==undefined&&!isGameId(seasonId)||!Number.isSafeInteger(skip)||skip<0||skip>100000)return response.status(400).json({error:'Vyberte platné období nejvýše 31 dnů do dneška a platnou stránku importu.'});
      Object.assign(scope,{from,to,seasonId,skip,limit:1,intervalMs:0});
    }
    try{
      await (options.ensureSchema??ensurePenaltyMinutesSchema)({env});
      if(batch){
        const result=await (options.backfill??backfillFinishedGamesPage)(scope);
        return response.status(200).json({organization:org.code,discovered:result.discovered,processed:result.processed,failed:result.failed,skip:result.skip,nextSkip:result.nextSkip,done:result.done,failures:(result.failures??[]).map(f=>({gameId:isGameId(f.gameId)?f.gameId:null,error:'Zápas se nepodařilo importovat.'}))});
      }
      const result=await (options.processGame??processFinishedGame)(body.gameId,scope);
      return response.status(200).json({imported:true,organization:org.code,gameId:result.gameId,score:result.score,priklepy:result.priklepy,events:result.events});
    }catch{return response.status(422).json({imported:false,error:'Import zápasu se nezdařil. Zkontrolujte organizaci, období/Game ID a serverové připojení.'});}
  };
}
