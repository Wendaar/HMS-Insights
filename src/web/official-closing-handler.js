import {organizationEntry,organizationConfig} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {toolStore} from '../infrastructure/tool-instances.js';
import {closingCatalog,closingContext,closingSources} from '../app/official-closing.js';
import {closingDraft,approveClosing} from '../domain/official-closing.js';
export const closingStorageNamespace=env=>env.VERCEL_ENV==='production'?'official-closing':'official-closing-preview';
const slugOK=v=>typeof v==='string'&&v.length<=64&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const reason=v=>{if(typeof v!=='string'||v.trim().length<8||v.length>1000||/[<>\x00-\x1f]/.test(v))throw new TypeError('reason');return v.trim();};
export function closingReview(draft,data,policy={},lang='en'){
 const problems=[];
 if(draft.standings.length!==data.eligibility.teamIds.length)problems.push('Every scoped team needs a final position.');
 if(draft.standings.some(r=>!Number.isInteger(r.rank)||r.rank<1||r.rank>data.eligibility.teamIds.length)||!draft.standings.some(r=>r.rank===1))problems.push('Final ranks must start at one and fit the scoped team count.');
 const ranks=new Map(),medals=new Map();
 for(const row of draft.standings){ranks.set(row.rank,(ranks.get(row.rank)??0)+1);if(row.medal){medals.set(row.medal,(medals.get(row.medal)??0)+1);if(row.rank!==({gold:1,silver:2,bronze:3})[row.medal])problems.push('Medal must match its position.');}}
 const tied=[...ranks.values()].some(n=>n>1)||[...medals.values()].some(n=>n>1);
 if(tied&&policy.allowTies!==true)problems.push('Joint positions require explicit approval.');
 if(policy.confirmFinal!==true)problems.push('Confirm final results after reviewing HMS coverage.');
 const partial=Object.values(data.provenance.coverage).some(v=>v!==true);
 if(partial&&policy.acceptPartial!==true)problems.push('Acknowledge missing source coverage.');
 if((tied||partial)&&!(typeof policy.reason==='string'&&policy.reason.trim().length>=8))problems.push('Explain ties or manual completion.');
 const cs={'Every scoped team needs a final position.':'Každý tým vybraného rozsahu musí mít konečné umístění.','Final ranks must start at one and fit the scoped team count.':'Umístění musí začínat jedničkou a odpovídat počtu týmů.','Medal must match its position.':'Medaile musí odpovídat umístění.','Joint positions require explicit approval.':'Sdílená místa vyžadují výslovné schválení.','Confirm final results after reviewing HMS coverage.':'Po kontrole podkladů HMS potvrďte konečnost výsledků.','Acknowledge missing source coverage.':'Potvrďte, že jste posoudili chybějící podklady.','Explain ties or manual completion.':'Zdůvodněte sdílená místa nebo ruční doplnění.'};
 return {valid:!problems.length,problems:lang==='cs'?problems.map(p=>cs[p]??p):problems,provenance:data.provenance};
}
export function createOfficialClosingHandler(options={}){
 const env=options.env??process.env,store=options.store??toolStore({env,tool:closingStorageNamespace(env)}),allStars=options.allStarsStore??toolStore({env,tool:'all-stars'});
 const sources=options.closingSources??closingSources;
 return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  const q=req.query??{},action=q.action??'public',en=q.lang==='en';
  const cs={'Unknown Closing action.':'Neznámá operace Closing.','Method not allowed.':'Nepovolená metoda.','Unknown organization.':'Neznámá organizace.','Invalid request origin.':'Nepovolený původ požadavku.','Closing is private.':'Closing není zveřejněný.','Central storage unavailable.':'Centrální úložiště není dostupné.','Closing changed. Reload before continuing.':'Closing změnil jiný správce. Načtěte jej znovu.','Approved Closing is locked. Reopen with a reason.':'Schválený Closing je uzamčený. Pro novou revizi uveďte důvod.'};
  const fail=(code,message)=>res.status(code).json({error:en?message:cs[message]??message});
  const mutations=['save','review','approve','reopen','publish','pause','delete'];
  if(!['catalog','context','sources','manage','review','public','list',...mutations].includes(action))return fail(400,'Unknown Closing action.');
  const method=mutations.includes(action)?'POST':'GET';if(req.method!==method){res.setHeader('allow',method);return fail(405,'Method not allowed.');}
  let org;try{org=organizationEntry(q.org,env);}catch{return fail(404,'Unknown organization.');}
  if(!['public','list'].includes(action)){
   const secret=env[`HMS_${org.code}_PORTAL_ADMIN_SECRET`]||env[`HMS_${org.code}_TOOLS_ADMIN_SECRET`]||env[`HMS_${org.code}_WEBHOOK_SECRET`]||(org.code==='PHM'?env.HMS_WEBHOOK_SECRET:null);
   if(!secret)return fail(503,en?'Management access unavailable.':'Přístup ke správě není nastaven.');
   if(!hasBearerSecret(req,secret))return fail(401,en?'Invalid organization access code.':'Neplatný přístupový kód organizace.');
   if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{return fail(403,'Invalid request origin.');}}
  }
  try{
   if(action==='catalog')return res.status(200).json(await(options.closingCatalog??closingCatalog)(org.code,{...options,env}));
   if(['context','sources'].includes(action))return res.status(200).json(await(action==='context'?(options.closingContext??closingContext):sources)(org.code,{...q,organization:org.slug},{...options,env}));
   if(action==='list'){
    const items=[];for(const row of await store.list(org.code)){const i=await store.get(org.code,row.slug),record=i?.draft;if(record?.publishedVersion&&!record.deleted){const p=record.versions.find(v=>v.approval.version===record.publishedVersion);if(p)items.push({slug:row.slug,title:p.title,scope:p.scope,version:p.approval.version});}}
    return res.status(200).json({items});
   }
   if(action==='manage'&&!q.instance)return res.status(200).json({items:await store.list(org.code)});
   if(!slugOK(q.instance))throw new TypeError('instance');
   const instance=await store.get(org.code,q.instance),state=instance?.draft??{config:null,versions:[],publishedVersion:null,locked:false,events:[]};
   if(action==='public'){
    const snapshot=state.versions.find(v=>v.approval.version===state.publishedVersion);
    if(!snapshot||state.deleted)return fail(404,'Closing is private.');
    // Deliberate projection: no draft, credential audit, revision reasons or editor fields.
    const {title,scope,standings,awards,allStars,provenance,approval,teams,players}=snapshot;
    return res.status(200).json({schemaVersion:1,org:org.slug,slug:q.instance,title,scope,standings,awards,allStars,provenance,approvedAt:approval.approvedAt,version:approval.version,teams,players});
   }
   if(action==='manage')return res.status(200).json({instance});
   if(!env.DATABASE_URL&&!options.store)return fail(503,'Central storage unavailable.');
   if(action==='approve'&&!options.store&&!await store.closingHistoryReady())return fail(503,en?'Apply Closing history migration 009 before approval.':'Před schválením aplikujte migraci historie Closing 009.');
   let body={};if(mutations.includes(action)){
    if(Buffer.byteLength(JSON.stringify(req.body??''))>100000)throw new TypeError('body size');
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body))throw new TypeError('body');
    if(!Number.isInteger(body.revision)||body.revision!==(instance?.revision??0))return fail(409,'Closing changed. Reload before continuing.');
   }
   const next=structuredClone(state),at=new Date().toISOString();
   let data,config,review;
   if(['save','review','approve'].includes(action)){
    if(state.deleted)throw new TypeError('deleted');
    if(action!=='review'&&state.locked)return fail(423,'Approved Closing is locked. Reopen with a reason.');
    const input=action==='save'?body.config:state.config;if(!input)throw new TypeError('draft');
    data=await sources(org.code,input.scope,{...options,env});
    config=closingDraft(input,data.eligibility);
    if(config.awards.some(a=>a.category==='goalie'&&!data.players.some(p=>p.playerId===a.playerId&&p.teamId===a.teamId&&p.role==='goalie')))throw new TypeError('goalie eligibility');
    if(config.scope.organization!==org.slug)throw new TypeError('organization');
    if(state.versions.length&&JSON.stringify(config.scope)!==JSON.stringify(state.versions[0].scope))throw new TypeError('immutable scope');
    review=closingReview(config,data,body.policy??{},en?'en':'cs');
    if(action==='review')return res.status(200).json({review,config});
    if(action==='save')next.config=config;
   }
   if(action==='approve'){
    if(!review.valid)return res.status(422).json({error:en?'Review required.':'Dokončete kontrolu výsledků.',review});
    let allStarsSnapshot=null;
    if(config.allStarsPublicationId){
     if(env.VERCEL_ENV!=='production'&&!options.allStarsStore)throw new TypeError('All Stars preview reference unavailable');
     if(!slugOK(config.allStarsPublicationId))throw new TypeError('All Stars reference');
     const ref=await allStars.get(org.code,config.allStarsPublicationId),p=ref?.published;
     if(!p?.output||p.seasonId!==config.scope.seasonId||!config.scope.groupId||p.groupId!==config.scope.groupId||config.scope.phaseId)throw new TypeError('All Stars scope');
     allStarsSnapshot={slug:config.allStarsPublicationId,publishedAt:ref.publishedAt,snapshot:p.output};
    }
    const actorId=organizationConfig(org.code,env).id;
    const snapshot=approveClosing({...config,provenance:data.provenance,teams:data.teams,
     players:data.players.filter(p=>config.awards.some(a=>a.playerId===p.playerId&&a.teamId===p.teamId)),allStars:allStarsSnapshot,
     policy:{confirmFinal:true,allowTies:body.policy?.allowTies===true,acceptPartial:body.policy?.acceptPartial===true,reason:body.policy?.reason?reason(body.policy.reason):null}},
     {actorId,approvedAt:at,version:state.versions.length+1});
    next.versions.push(snapshot);next.locked=true;
   }
   if(action==='reopen'){
    if(!state.locked)throw new TypeError('not locked');
    next.locked=false;next.events.push({action,reason:reason(body.reason),at,actor:'organization-admin'});
   }
   if(action==='publish'){
    if(!Number.isInteger(body.version)||!state.versions.some(v=>v.approval.version===body.version))throw new TypeError('version');
    if(state.deleted)throw new TypeError('deleted');next.publishedVersion=body.version;
    next.events.push({action,version:body.version,at,actor:'organization-admin'});
   }
   if(action==='pause')next.publishedVersion=null;
   if(action==='delete'){
    if(state.versions.length)throw new TypeError('approved history cannot be deleted');
    next.deleted=true;next.config=null;next.publishedVersion=null;
   }
   if(next.versions.length>100||next.events.length>500)throw new TypeError('history limit');
   const saved=await store.save(org.code,q.instance,next,body.revision,null);
   return saved?res.status(200).json({instance:saved}):fail(409,'Closing changed. Reload before continuing.');
  }catch(error){return fail(error instanceof TypeError||error instanceof SyntaxError?400:503,en?'Check Closing scope, selection and data connection.':'Zkontrolujte rozsah Closingu, výběr a datové připojení.');}
 };
}
