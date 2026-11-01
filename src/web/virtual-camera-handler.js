import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {normalize} from '../../public/virtual-camera/core.js';
const valid=v=>typeof v==='string'&&/^[a-f0-9]{48}$/.test(v);
const digest=v=>createHash('sha256').update(v).digest('hex');
const outputKey=v=>createHmac('sha256',v).update('hero-camera-output-v1').digest('hex').slice(0,48);
const matches=(key,hash)=>typeof hash==='string'&&hash.length===64&&timingSafeEqual(Buffer.from(digest(key)),Buffer.from(hash));
export const cameraTable=env=>env.VERCEL_ENV==='production'?'hero_camera_sessions':'hero_camera_sessions_preview';
export function createCameraStore(env){
 const table=cameraTable(env);let sql,ready;
 async function db(){if(!env.DATABASE_URL)throw Error('storage');sql??=neon(env.DATABASE_URL);
  ready??=sql.query(`CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, edit_hash text NOT NULL, read_hash text NOT NULL, state jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, operator_at bigint NOT NULL DEFAULT 0, output_at bigint NOT NULL DEFAULT 0, output_status text NOT NULL DEFAULT 'Neznámý', updated_at timestamptz NOT NULL DEFAULT now())`).catch(e=>{ready=null;throw e;});await ready;return sql;
 }
 return {
  async create(id,edit,read,state){return(await(await db()).query(`INSERT INTO ${table} (id,edit_hash,read_hash,state) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,[id,edit,read,JSON.stringify(state)]))[0];},
  async get(id){return(await(await db()).query(`SELECT * FROM ${table} WHERE id=$1`,[id]))[0];},
  async update(id,hash,revision,state,now){return(await(await db()).query(`UPDATE ${table} SET state=$4::jsonb,revision=revision+1,operator_at=$5,updated_at=now() WHERE id=$1 AND edit_hash=$2 AND revision=$3 RETURNING *`,[id,hash,revision,JSON.stringify(state),now]))[0];},
  async touch(id,hash,role,now,status){const column=role==='edit'?'edit_hash':'read_hash';const assignments=role==='edit'?'operator_at=$3':'output_at=$3,output_status=$4';return(await(await db()).query(`UPDATE ${table} SET ${assignments} WHERE id=$1 AND ${column}=$2 RETURNING *`,role==='edit'?[id,hash,now]:[id,hash,now,status]))[0];},
 };
}
export function createVirtualCameraHandler(options={}){
 const env=options.env??process.env,store=options.store??createCameraStore(env),limits=new Map();const now=()=>options.now?.()??Date.now();
 const result=(row,key,edit)=>({...row.state,revision:row.revision,operatorAt:Number(row.operator_at),outputAt:Number(row.output_at),outputStatus:row.output_status,serverNow:now(),...(edit?{outputKey:outputKey(key)}:{})});
 return async(req,res)=>{
  for(const [k,v] of Object.entries({'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','vary':'Authorization'}))res.setHeader(k,v);
  const fail=(status,error)=>res.status(status).json({error});
  try{
   if(!['GET','POST','PUT'].includes(req.method)){res.setHeader('allow','GET, POST, PUT');return fail(405,'Nepovolená metoda.');}
   if(req.method!=='GET'&&req.headers?.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{return fail(403,'Požadavek z jiné stránky není povolen.');}}
   let body={};if(req.method!=='GET'){if(!String(req.headers?.['content-type']??'').startsWith('application/json'))return fail(415,'Očekáván JSON.');body=typeof req.body==='string'?JSON.parse(req.body):req.body??{};if(Buffer.byteLength(JSON.stringify(body))>12000)return fail(413,'Příliš velký požadavek.');}
   const action=req.query?.action??'state',id=req.query?.session;
   if(action==='create'&&req.method==='POST'){
    const ip=digest(String(req.headers?.['x-forwarded-for']??req.socket?.remoteAddress??'unknown'));const hits=(limits.get(ip)||[]).filter(t=>t>now()-60000);if(hits.length>=5)return fail(429,'Další relaci vytvořte za minutu.');limits.set(ip,[...hits,now()]);if(limits.size>500)limits.delete(limits.keys().next().value);
    const id=randomBytes(24).toString('hex'),key=randomBytes(24).toString('hex');await store.create(id,digest(key),digest(outputKey(key)),normalize({}));return res.status(201).json({id,key});
   }
   if(!valid(id))return fail(400,'Neplatná relace.');const key=/^Bearer ([a-f0-9]{48})$/.exec(req.headers?.authorization??'')?.[1];if(!key)return fail(403,'Chybí klíč relace.');
   const row=await store.get(id);if(!row)return fail(404,'Relace neexistuje.');const edit=matches(key,row.edit_hash),read=matches(key,row.read_hash);if(!edit&&!read)return fail(403,'Neplatný klíč relace.');
   if(action==='state'&&req.method==='GET')return res.status(200).json(result(row,key,edit));
   if(action==='state'&&req.method==='PUT'&&edit){if(!Number.isSafeInteger(body.revision)||body.revision<1)return fail(400,'Chybí verze nastavení.');let state;try{state=normalize(body);}catch{return fail(400,'Vložte platný přijímací odkaz https://vdo.ninja/?view=ID.');}const saved=await store.update(id,digest(key),body.revision,state,now());return saved?res.status(200).json(result(saved,key,true)):fail(409,'Relaci změnil jiný režisér. Obnovuji aktuální stav.');}
   if(req.method==='POST'&&((action==='heartbeat'&&edit)||(action==='report'&&read))){const saved=await store.touch(id,digest(key),edit?'edit':'read',now(),String(body.status??'Neznámý').slice(0,100));return saved?res.status(200).json(result(saved,key,edit)):fail(403,'Přístup byl odmítnut.');}
   return fail(403,'Výstupní odkaz nemůže ovládat kameru.');
  }catch(e){return fail(e instanceof SyntaxError?400:503,e instanceof SyntaxError?'Neplatný JSON.':'Kameru se nepodařilo připojit k úložišti. Zkuste to znovu.');}
 };
}
