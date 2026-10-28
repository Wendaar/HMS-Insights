import {organizationEntry,publicOrganizations} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {toolStore} from '../infrastructure/tool-instances.js';
import {portalSettings,portalCatalog,validatePortalSeasons,portalDirectory,portalPartners,portalModule,portalSections} from '../app/public-portal.js';
export const portalStorageNamespace=env=>env.VERCEL_ENV==='production'?'public-portal':'public-portal-preview';
export function createPublicPortalHandler(options={}){
 const env=options.env??process.env,store=options.store??toolStore({env,tool:portalStorageNamespace(env)});
 return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  const q=req.query??{},action=q.action??'public',fail=(code,error)=>res.status(code).json({error});
  const actions=['organizations','catalog','manage','save','publish','pause','public','preview','data','preview-data','extras-document'];
  if(!actions.includes(action))return fail(400,'Neznámá operace.');
  const method=['save','publish','pause'].includes(action)?'POST':'GET';
  if(req.method!==method){res.setHeader('allow',method);return fail(405,'Nepovolená metoda.');}
  if(action==='organizations')return res.status(200).json({organizations:publicOrganizations(env)});
  let org;try{org=organizationEntry(q.org,env);}catch{return fail(404,'Neznámá organizace.');}
  const secret=env[`HMS_${org.code}_TOOLS_ADMIN_SECRET`]||env[`HMS_${org.code}_WEBHOOK_SECRET`]||(org.code==='PHM'?env.HMS_WEBHOOK_SECRET:null);
  if(['catalog','manage','save','publish','pause','preview','preview-data'].includes(action)){
   if(!secret)return fail(503,'Správa organizace zatím nemá nastavený přístup.');
   if(!hasBearerSecret(req,secret))return fail(401,'Zadejte platný přístupový kód organizace.');
   if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{return fail(403,'Nepovolený původ požadavku.');}}
  }
  try{
   if(action==='catalog')return res.status(200).json(await(options.portalCatalog??portalCatalog)(org.code,options));
   const instance=await store.get(org.code,'main'),path='/league/'+org.slug;
   if(action==='manage')return res.status(200).json({org:org.code,path,instance,sections:portalSections});
   if(['save','publish','pause'].includes(action)){
    let b;try{if(Buffer.byteLength(JSON.stringify(req.body??''))>50000)throw Error();b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||Array.isArray(b))throw Error();}catch{return fail(400,'Neplatné nastavení.');}
    if(!Number.isInteger(b.revision)||b.revision!==(instance?.revision??0))return fail(409,'Nastavení změnil jiný správce. Načtěte je znovu.');
    let saved;
    if(action==='save'){const config=portalSettings(b.config);await validatePortalSeasons(org.code,config,options);saved=await store.save(org.code,'main',config,b.revision,null);}
    else {
     if(!instance)throw new TypeError('draft');
     if(action==='publish'){const config=portalSettings(instance.draft);await validatePortalSeasons(org.code,config,options);saved=await store.publish(org.code,'main',b.revision);}
     else saved=await store.unpublish(org.code,'main',b.revision);
    }
    return saved?res.status(200).json({org:org.code,path,instance:saved}):fail(409,'Nastavení se změnilo. Načtěte je znovu.');
   }
   const preview=action.startsWith('preview'),raw=preview?instance?.draft:instance?.published;
   if(!raw)return fail(404,'Portál není zveřejněný.');
   const config=portalSettings(raw),seasons=await validatePortalSeasons(org.code,config,options);
   const section=action==='extras-document'?'extras':q.section??'home';
   if(!config.sections.includes(section))return fail(404,'Tato sekce není zveřejněná.');
   const season=seasons.find(s=>s.seasonId===(q.seasonId??config.defaultSeasonId));
   if(!season)return fail(404,'Tato sezona není zveřejněná.');
   if(action==='extras-document'){
    res.setHeader('content-type','text/html; charset=utf-8');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('content-security-policy',"sandbox allow-scripts allow-popups; default-src https: data:; script-src https: 'unsafe-inline'; style-src https: 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'");
    return res.status(200).send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;margin:20px;overflow-wrap:anywhere}img,iframe{max-width:100%}</style>'+config.extras);
   }
   if(['public','preview'].includes(action)){
    const {extras,...publicConfig}=config;
    return res.status(200).json({org:{code:org.code,slug:org.slug,name:org.name},path,config:publicConfig,seasons,season,publishedAt:instance.publishedAt,preview});
   }
   let data={};
   if(section==='extras')data={html:config.extras};
   else if(['teams','venues','system'].includes(section)){
    const directory=await(options.portalDirectory??portalDirectory)(org.code,season.seasonId,options);
    data=section==='teams'?{teams:directory.teams,source:directory.source}:section==='venues'?{venues:directory.venues,source:directory.source}:{groups:directory.groups,source:directory.source};
    if(section==='teams')try{const partners=await portalPartners(org.code,season,options);data.teams=data.teams.map(t=>({...t,logoUrl:partners.teams.find(p=>p.id===t.id)?.logoUrl??null}));}catch{/* Names remain usable without optional logos. */}
   }else if(section==='home'){
    try{data={sponsors:(await portalPartners(org.code,season,options)).items,sponsorsAvailable:true};}catch{data={sponsors:[],sponsorsAvailable:false};}
   }else data={moduleUrl:portalModule(section,org,season,q.lang==='en'?'en':config.lang)};
   return res.status(200).json({section,seasonId:season.seasonId,...data});
  }catch(e){return e instanceof TypeError?fail(400,'Zkontrolujte nastavení portálu a vybrané sezony.'):fail(503,'Data portálu nejsou dostupná. Zkuste načtení znovu.');}
 };
}
