import {processFinishedGame} from '../app/process-finished-game.js';
import {organizationConfig} from '../app/organizations.js';
import {hmsConfigFromEnv} from '../hms/client.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function createHmsWebhookHandler(options={}){
  return async(request,response)=>{
    response.setHeader('cache-control','no-store');
    if(request.method!=='POST')return response.status(405).json({error:'Method not allowed'});
    const env=options.env??process.env;let organization;
    try{organization=organizationConfig(request.query?.org??'PHM',env);}catch{return response.status(404).json({error:'Organization unavailable'});}
    if(!organization.token||!organization.webhookSecret)return response.status(503).json({error:'Integration unavailable'});
    if(!hasBearerSecret(request,organization.webhookSecret))return response.status(401).json({error:'Unauthorized'});
    let payload;
    try{payload=typeof request.body==='string'?JSON.parse(request.body):request.body;}catch{return response.status(400).json({accepted:false,error:'Invalid JSON'});}
    // The route owns identity; a caller-supplied UUID can never choose the tenant.
    if(payload?.organizationId&&!same(payload.organizationId,organization.id))return response.status(422).json({accepted:false,error:'Organization mismatch'});
    if(payload?.type==='ping')return response.status(200).json({accepted:true,type:'ping',eventId:payload.eventId??null});
    if(!['game.finished','game.updated'].includes(payload?.type))return response.status(202).json({accepted:false,reason:'unsupported_event'});
    if(!same(payload.organizationId,organization.id))return response.status(422).json({accepted:false,error:'Organization mismatch'});
    try{
      const result=await (options.processGame??processFinishedGame)(payload.gameId,{env,config:hmsConfigFromEnv({...env,HMS_API_TOKEN:organization.token}),expectedOrganizationId:organization.id});
      return response.status(200).json({accepted:true,eventId:payload.eventId??null,...result});
    }catch{return response.status(422).json({accepted:false,error:'Game import failed'});}
  };
}
