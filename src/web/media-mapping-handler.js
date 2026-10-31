import {organizationEntry,organizationConfig} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {toolStore} from '../infrastructure/tool-instances.js';
import {readMediaAssets,mediaMapping} from '../app/media-mapping.js';
import {loadSponsorCatalog} from '../app/sponsors.js';
import {fetchGameDetail,hmsConfigFromEnv} from '../hms/client.js';
export const mediaTool=env=>env.VERCEL_ENV==='production'?'media-mapping':'media-mapping-preview';
export function createMediaMappingHandler(options={}){
  const env=options.env??process.env,store=options.store??toolStore({env,tool:mediaTool(env)});
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
    const fail=(code,error)=>res.status(code).json({error});const q=req.query??{},action=q.action??'public';
    if(!['public','access','manage','save','publish','context'].includes(action))return fail(400,'Neznámá operace.');
    const method=['save','publish'].includes(action)?'POST':'GET';if(req.method!==method){res.setHeader('allow',method);return fail(405,'Nepovolená metoda.');}
    let org;try{org=organizationEntry(q.org,env);}catch{return fail(404,'Neznámá organizace.');}
    const secret=env[`HMS_${org.code}_TOOLS_ADMIN_SECRET`]||env[`HMS_${org.code}_WEBHOOK_SECRET`]||(org.code==='PHM'?env.HMS_WEBHOOK_SECRET:null),operationsSecret=env[`HMS_${org.code}_OPERATIONS_SECRET`],storageReady=!!(env.DATABASE_URL||options.store);
    if(action==='access')return res.status(200).json({org:org.code,configured:!!(secret||operationsSecret),operationsConfigured:!!operationsSecret,storageReady,sandbox:mediaTool(env).endsWith('preview')});
    if(['manage','save','publish'].includes(action)){
      if(!secret&&!operationsSecret)return fail(503,'Přístup správce ani Operations této organizace není nastavený.');if(!hasBearerSecret(req,secret)&&!hasBearerSecret(req,operationsSecret))return fail(401,'Zadejte kód Operations nebo správy pro vybranou organizaci.');
      if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw new Error();}catch{return fail(403,'Nepovolený původ požadavku.');}}
    }
    try{
      const assets=await(options.readAssets??readMediaAssets)(org.code),empty={schemaVersion:1,org:org.code,bindings:[]};
      if(action==='context'){const config=organizationConfig(org.code,env);if(!config.token)throw new Error();return res.status(200).json(await(options.loadSponsors??loadSponsorCatalog)(config,{...options,env}));}
      const instance=await store.get(org.code,'library');
      if(action==='public')return res.status(200).json({org:org.code,assets,config:instance?.published??empty,publishedAt:instance?.publishedAt??null,storageReady,sourceBranch:env.VERCEL_GIT_COMMIT_REF??'main',sandbox:mediaTool(env).endsWith('preview')});
      if(action==='manage')return res.status(200).json({org:org.code,assets,instance:instance??{draft:empty,revision:0,published:null},storageReady,sandbox:mediaTool(env).endsWith('preview')});
      if(!storageReady)return fail(503,'Centrální databáze není připojená. Koncept se nezveřejnil.');
      if(!String(req.headers['content-type']??'').startsWith('application/json'))return fail(400,'Vyžadován JSON.');
      let body;try{if(Buffer.byteLength(JSON.stringify(req.body??''))>100000)return fail(413,'Konfigurace je příliš velká.');body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'Neplatná konfigurace.');}
      if(!Number.isInteger(body?.revision)||body.revision!==(instance?.revision??0))return fail(409,'Konfiguraci mezitím změnil jiný správce. Načtěte ji znovu.');
      if(action==='publish'&&!instance)return fail(400,'Nejdříve uložte koncept.');
      const config=mediaMapping(action==='save'?body.config:instance.draft,org.code,assets);
      const targets=config.bindings.filter(b=>b.scope!=='default');
      if(targets.length){
        const scoped=organizationConfig(org.code,env);if(!scoped.token)throw new Error();
        if(targets.some(b=>['team','sponsor'].includes(b.scope))){const catalog=await(options.loadSponsors??loadSponsorCatalog)(scoped,{...options,env});if(catalog.org!==org.code)throw new Error();
          for(const b of targets)if(b.scope==='team'?!catalog.teams.some(t=>t.id.toLowerCase()===b.targetId):b.scope==='sponsor'?!catalog.items.some(s=>s.id.toLowerCase()===b.targetId):false)throw new TypeError('Tým nebo sponzor nepatří do katalogu této organizace.');}
        const games=[...new Set(targets.filter(b=>b.scope==='game').map(b=>b.targetId))];if(games.length>20)throw new TypeError('Jedna knihovna může mít výjimky nejvýše pro 20 zápasů.');
        for(let i=0;i<games.length;i+=4)await Promise.all(games.slice(i,i+4).map(async gameId=>{const game=await(options.fetchDetail??fetchGameDetail)(gameId,{config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:scoped.token}),timeoutMs:5000,retries:0}});if(game?.gameId?.toLowerCase()!==gameId||game?.organizationId?.toLowerCase()!==scoped.id.toLowerCase())throw new TypeError('Zápas nepatří do vybrané organizace.');}));
      }
      const saved=action==='save'?await store.save(org.code,'library',config,body.revision,null):await store.publish(org.code,'library',body.revision);
      return saved?res.status(200).json({org:org.code,instance:saved}):fail(409,'Konfiguraci změnil jiný správce. Obnovte ji.');
    }catch(error){return fail(error instanceof TypeError?400:503,error instanceof TypeError?error.message:'Media Mapping není dostupný. Ověřte databázi, katalog souborů a připojení organizace.');}
  };
}
