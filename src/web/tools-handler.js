import {organizationEntry} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {bootstrapInstance,validateSettings,publicSettings} from '../app/playoff-players.js';
import {readPlayoffSource} from '../infrastructure/tool-sources.js';
import {toolStore} from '../infrastructure/tool-instances.js';
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function createToolsHandler(options={}){
  const env=options.env??process.env,store=options.store??toolStore({env}),read=options.readSource??readPlayoffSource;
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
    const fail=(status,error)=>res.status(status).json({error});
    const action=req.query?.action??'public';
    const admin=action!=='public';
    const methods=admin&&action!=='manage'?'POST':'GET';
    if(!['public','manage','preview','save','publish','duplicate'].includes(action))return fail(400,'Neznámá operace.');
    if(req.method!==methods){res.setHeader('allow',methods);return fail(405,'Nepovolená metoda.');}
    let org;try{org=organizationEntry(req.query?.org??'phm',env);}catch{return fail(404,'Neznámá organizace.');}
    const slug=req.query?.instance??'phm-cup-2026';
    if(typeof slug!=='string'||slug.length>64||!slugPattern.test(slug))return fail(400,'Neplatná adresa výstupu.');
    if(admin){
      const secret=env[`HMS_${org.code}_TOOLS_ADMIN_SECRET`]||env[`HMS_${org.code}_WEBHOOK_SECRET`]||(org.code==='PHM'?env.HMS_WEBHOOK_SECRET:null);
      if(!secret)return fail(503,'Správa není připojena. Je potřeba nastavit administrátorský přístup této organizace na serveru.');
      if(!hasBearerSecret(req,secret))return fail(401,'Nesprávný přístupový klíč organizace.');
      if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw new Error();}catch{return fail(403,'Požadavek pochází z jiné stránky.');}}
    }
    let body={};
    if(req.method==='POST'){
      try{if(Buffer.byteLength(JSON.stringify(req.body??''))>20000)return fail(413,'Nastavení je příliš velké.');body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}
      catch{return fail(400,'Neplatné nastavení.');}
    }
    try{
      const bootstrap=bootstrapInstance(org.code,slug),instance=await store.get(org.code,slug)??bootstrap;
      if(action==='manage'){
        const list=await store.list(org.code);
        if(org.code==='PHM'&&!list.some(i=>i.slug==='phm-cup-2026'))list.unshift({slug:'phm-cup-2026',title:'Hráči pro playoff 2026',revision:0,published:true});
        return res.status(200).json({org:org.code,slug,instance,list,storageReady:!!env.DATABASE_URL});
      }
      if(action==='public'){
        if(!instance?.published)return fail(404,'Tento výstup zatím není publikovaný.');
        const data=await read(instance.published);
        return res.status(200).json({org:org.code,slug,config:publicSettings(instance.published),players:data.players,warnings:data.warnings,readAt:data.readAt,sourceLabel:data.sourceLabel,publishedAt:instance.publishedAt});
      }
      if(action==='preview'){
        let config;try{config=validateSettings(body.config);}catch(error){return fail(400,error.message);}
        const data=await read(config);
        return res.status(200).json({org:org.code,slug,config:publicSettings(config),...data});
      }
      if(!env.DATABASE_URL&&!options.store)return fail(503,'Centrální ukládání není připojeno. Nastavte databázi na serveru.');
      if(action==='duplicate'){
        if(!instance)return fail(404,'Výchozí nastavení neexistuje.');
        const target=body.slug;
        if(typeof target!=='string'||target.length>64||!slugPattern.test(target)||target===slug)return fail(400,'Zvolte novou adresu: malá písmena, číslice a pomlčky.');
        if(bootstrapInstance(org.code,target)||await store.get(org.code,target))return fail(409,'Tato adresa už existuje.');
        const config=validateSettings({...instance.draft,title:body.title});
        const saved=await store.save(org.code,target,config,0,null);
        return saved?res.status(201).json({slug:target,instance:saved}):fail(409,'Tato adresa už existuje.');
      }
      if(!Number.isInteger(body.revision)||body.revision<0||body.revision!==(instance?.revision??0))return fail(409,'Nastavení mezitím změnil jiný správce. Načtěte aktuální verzi.');
      if(action==='save'){
        let config;try{config=validateSettings(body.config);}catch(error){return fail(400,error.message);}
        const saved=await store.save(org.code,slug,config,body.revision,bootstrap);
        return saved?res.status(200).json({instance:saved}):fail(409,'Nastavení mezitím změnil jiný správce. Načtěte aktuální verzi.');
      }
      if(!instance||instance.revision===0)return fail(400,'Nejdříve uložte pracovní verzi.');
      const data=await read(instance.draft);
      if(!data.players.length)return fail(422,'Zdroj neobsahuje hráče odpovídající nastaveným filtrům. Publikace se nezměnila.');
      const published=await store.publish(org.code,slug,body.revision);
      return published?res.status(200).json({instance:published}):fail(409,'Nastavení se změnilo během kontroly dat. Načtěte aktuální verzi.');
    }catch(error){
      // Known source failures are actionable, infrastructure/DB errors stay private.
      const safe=/^(Zdroj |Chybí sloupec|Google tabulka|Nepovolené přesměrování|Řádek |Neukončená |Chybějící nebo |Neplatný CSV)/.test(error.message);
      return fail(503,safe?error.message:'Aplikace nemůže načíst data nebo centrální nastavení. Zkuste to znovu nebo ověřte připojení.');
    }
  };
}
