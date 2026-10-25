import {organizationEntry,publicOrganizations} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {readOperations} from '../app/operations.js';
export function createOperationsHandler(options={}){return async(req,res)=>{
 res.setHeader('cache-control','private, no-store');res.setHeader('vary','Authorization');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
 const fail=(code,error)=>res.status(code).json({error});
 if(req.method!=='GET'){res.setHeader('allow','GET');return fail(405,'Pouze čtení.');}
 const env=options.env??process.env;let org;
 try{org=organizationEntry(req.query?.org,env);}catch{return fail(404,'Neznámá organizace.');}
 const secret=env[`HMS_${org.code}_OPERATIONS_SECRET`];
 if(req.query.action==='access')return res.status(200).json({org:org.code,configured:!!secret,organizations:publicOrganizations(env).map(({code,slug,name})=>({code,slug,name}))});
 if(!secret)return fail(503,'Provozní přístup této organizace čeká na nastavení.');
 if(!hasBearerSecret({...req,headers:{authorization:req.headers?.authorization}},secret))return fail(401,'Zadejte platný provozní kód organizace.');
 try{return res.status(200).json(await(options.read??readOperations)(req.query,options));}
 catch(e){if(e instanceof TypeError)return fail(400,e.message);return fail(503,'Data nelze úplně načíst. Zúžte období nebo ověřte připojení HMS. Neúplné součty se nezobrazují.');}
};}
