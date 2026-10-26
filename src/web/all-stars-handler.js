import {organizationEntry,publicOrganizations} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {toolStore} from '../infrastructure/tool-instances.js';
import {allStarsSettings,readAllStars,resolvedSelection} from '../app/all-stars.js';
import {controlContextCatalog} from '../app/control-context.js';
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function createAllStarsHandler(options={}){
  const env=options.env??process.env,store=options.store??toolStore({env,tool:'all-stars'}),read=options.readAllStars??readAllStars;
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
    const en=req.query?.lang==='en',fail=(code,cs,enText)=>res.status(code).json({error:en?(enText??'All Stars data unavailable. Please check the organization connection.'):cs});
    const q=req.query??{},action=q.action??'public';
    if(!['organizations','catalog','candidates','access','manage','save','publish','public','list'].includes(action))return fail(400,'Neznámá operace.','Unknown action.');
    const method=['save','publish'].includes(action)?'POST':'GET';
    if(req.method!==method){res.setHeader('allow',method);return fail(405,'Nepovolená metoda.','Method not allowed.');}
    if(action==='organizations')return res.status(200).json({organizations:publicOrganizations(env)});
    let org;try{org=organizationEntry(q.org,env);}catch{return fail(404,'Neznámá organizace.','Unknown organization.');}
    const secret=env[`HMS_${org.code}_TOOLS_ADMIN_SECRET`]||env[`HMS_${org.code}_WEBHOOK_SECRET`]||(org.code==='PHM'?env.HMS_WEBHOOK_SECRET:null);
    if(action==='access')return res.status(200).json({org:org.code,configured:!!secret,storageReady:!!env.DATABASE_URL});
    if(['manage','save','publish'].includes(action)){
      if(!secret)return fail(503,'Správa organizace zatím nemá nastavený přístup.','Organization management access is not configured.');
      if(!hasBearerSecret(req,secret))return fail(401,'Nesprávný přístupový kód organizace.','Invalid organization access code.');
      if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw new Error();}catch{return fail(403,'Nepovolený původ požadavku.','Invalid request origin.');}}
    }
    try{
      if(action==='catalog')return res.status(200).json(await controlContextCatalog(org.code,{...options,env}));
      if(action==='candidates')return res.status(200).json(await read(org.code,q,{...options,env}));
      if(action==='list')return res.status(200).json({org:org.code,items:(await store.list(org.code)).filter(i=>i.published).map(i=>({slug:i.slug}))});
      if(action==='manage'&&!q.instance)return res.status(200).json({org:org.code,instance:null,list:await store.list(org.code)});
      const slug=q.instance;
      if(typeof slug!=='string'||slug.length>64||!slugPattern.test(slug))throw new TypeError('slug');
      const instance=await store.get(org.code,slug);
      if(action==='public'){
        if(!instance?.published)return fail(404,'Sestava zatím není publikovaná.','This lineup has not been published yet.');
        // The public result is frozen at publication; subsequent drafts/imports cannot alter it.
        const p=instance.published;
        return res.status(200).json({org:org.code,slug,title:p.title,scope:{month:p.month,seasonId:p.seasonId,groupId:p.groupId},output:p.output,publishedAt:instance.publishedAt});
      }
      if(action==='manage')return res.status(200).json({org:org.code,slug,instance,list:await store.list(org.code)});
      if(!env.DATABASE_URL&&!options.store)return fail(503,'Centrální ukládání není připojeno.','Central storage is not configured.');
      let body;try{if(Buffer.byteLength(JSON.stringify(req.body??''))>20000)throw new Error();body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return fail(400,'Neplatné nastavení.','Invalid settings.');}
      if(!Number.isInteger(body.revision)||body.revision!==(instance?.revision??0))return fail(409,'Nastavení změnil jiný správce. Načtěte jej znovu.','Another editor changed the draft. Reload it.');
      if(action==='save'){
        const config=allStarsSettings(body.config,org.code),data=await read(org.code,config,{...options,env});
        resolvedSelection(config,data);
        const saved=await store.save(org.code,slug,config,body.revision,null);
        return saved?res.status(200).json({instance:saved}):fail(409,'Nastavení se změnilo.','The draft changed.');
      }
      if(!instance)throw new TypeError('draft');
      const config=allStarsSettings(instance.draft,org.code),data=await read(org.code,config,{...options,env});
      if(!data.monthClosed||!data.coverage.complete)return fail(422,'Publikace vyžaduje uzavřený měsíc a všechny dokončené zápasy s ověřenými statistikami.','Publication requires a closed month and verified statistics for every finished game.');
      const lineup=resolvedSelection(config,data,{complete:true});
      const output={lineup,graphics:config.graphics,season:data.season,group:data.groups.find(g=>g.id===config.groupId),coverage:data.coverage,readAt:data.readAt,rules:data.rules,source:data.source};
      // Compare-and-swap twice: publishing never overwrites a concurrent edit.
      const frozen=await store.save(org.code,slug,{...config,output},body.revision,null);
      if(!frozen)return fail(409,'Nastavení se změnilo.','The draft changed.');
      const published=await store.publish(org.code,slug,frozen.revision);
      return published?res.status(200).json({instance:published}):fail(409,'Nastavení se změnilo.','The draft changed.');
    }catch(error){
      if(error instanceof TypeError)return fail(400,'Zkontrolujte sezonu, měsíc, divizi a výběr 3+2+1.','Check the season, month, division and 3+2+1 selection.');
      return fail(503,'Data All Stars nejsou dostupná. Ověřte připojení organizace a zkuste to znovu.');
    }
  };
}
