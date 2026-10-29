import {normalizeRotation} from '../../public/sponsors/rotation.js';
import {randomBytes,createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {organizationConfig,organizationEntry} from '../app/organizations.js';
import {isGameId} from '../domain/game-summary.js';
import {broadcastLibrary,LIBRARY_BYTES} from '../domain/broadcast-library.js';
export const channelId=v=>typeof v==='string'&&/^[a-f0-9]{48}$/.test(v);
const digest=v=>createHash('sha256').update(v).digest('hex');
export function channelState(value,env){
  if(!value||value.org!==organizationEntry(value.org,env).code||!isGameId(value.gameId)||!organizationConfig(value.org,env).token
    ||!['cs','en'].includes(value.lang)||!['opening','periods','lineup','scoresheet','insights','cta','sponsors','announcement','powerplay','leaders','leaders-strip','standings','next','results'].includes(value.layer)
    ||!['home','away','both'].includes(value.side)||!['current','1','2','3'].includes(value.period)
    ||!Number.isInteger(value.page)||value.page<1||value.page>50||typeof value.visible!=='boolean'
    ||value.insight!==''&&!isGameId(value.insight))throw new TypeError('Invalid channel state');
  const state=Object.fromEntries(['org','gameId','lang','layer','side','period','page','insight','visible'].map(k=>[k,value[k]]));
  for(const [key,allowed] of Object.entries({corner:['top-left','top-right','bottom-left','bottom-right'],metric:['goals','assists','points'],partnerSource:['hms','library'],partnerScope:['organization','team'],standingsView:['opponents','full']}))if(value[key]!==undefined){if(!allowed.includes(value[key]))throw new TypeError();state[key]=value[key];}
  if(value.assetId!==undefined){if(value.assetId!==''&&!isGameId(value.assetId))throw new TypeError();state.assetId=value.assetId;}
  if(value.rotateSeconds!==undefined){if(!Number.isInteger(value.rotateSeconds)||value.rotateSeconds<5||value.rotateSeconds>300)throw new TypeError();state.rotateSeconds=value.rotateSeconds;}
  if(value.sponsorRotation!==undefined)state.sponsorRotation=normalizeRotation(value.sponsorRotation);
  return state;
}
export const channelTables=env=>env.VERCEL_ENV==='production'&&env.BROADCAST_SANDBOX!=='1'?{channels:'broadcast_channels',library:'broadcast_libraries'}:{channels:'broadcast_channels_preview',library:'broadcast_libraries_preview'};
export function createChannelStore(env){
  const table=channelTables(env);
  let sql,ready;
  async function db(){
    if(!env.DATABASE_URL)throw new Error('No channel database');
    sql??=neon(env.DATABASE_URL);
    ready??=(async()=>{await sql.query(`CREATE TABLE IF NOT EXISTS ${table.channels} (id text PRIMARY KEY, control_hash text NOT NULL, state jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now())`);await sql.query(`CREATE TABLE IF NOT EXISTS ${table.library} (channel_id text PRIMARY KEY REFERENCES ${table.channels}(id) ON DELETE CASCADE, items jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 1)`);})().catch(e=>{ready=null;throw e;});
    await ready;return sql;
  }
  return {
    async create(id,hash,state){const dbsql=await db();const rows=await dbsql.query(`INSERT INTO ${table.channels} (id,control_hash,state) VALUES ($1,$2,$3::jsonb) RETURNING id,state,revision,updated_at`,[id,hash,JSON.stringify(state)]);return rows[0];},
    async get(id){const dbsql=await db();return (await dbsql.query(`SELECT c.id,c.state,c.revision,c.updated_at,coalesce(l.revision,0) as library_revision FROM ${table.channels} c LEFT JOIN ${table.library} l ON l.channel_id=c.id WHERE c.id=$1`,[id]))[0];},
    async update(id,hash,revision,state){const dbsql=await db();return (await dbsql.query(`UPDATE ${table.channels} SET state=$4::jsonb,revision=revision+1,updated_at=now() WHERE id=$1 AND control_hash=$2 AND revision=$3 RETURNING id,state,revision,updated_at`,[id,hash,revision,JSON.stringify(state)]))[0];},
    async library(id){const dbsql=await db();return (await dbsql.query(`SELECT items,revision FROM ${table.library} WHERE channel_id=$1`,[id]))[0]??{items:[],revision:0};},
    async saveLibrary(id,hash,revision,items){const dbsql=await db();return (await dbsql.query(`INSERT INTO ${table.library} (channel_id,items,revision) SELECT id,$4::jsonb,1 FROM ${table.channels} WHERE id=$1 AND control_hash=$2 AND $3::int=0 ON CONFLICT (channel_id) DO NOTHING RETURNING items,revision`,[id,hash,revision,JSON.stringify(items)]))[0]??(await dbsql.query(`UPDATE ${table.library} l SET items=$4::jsonb,revision=l.revision+1 FROM ${table.channels} c WHERE l.channel_id=c.id AND c.id=$1 AND c.control_hash=$2 AND l.revision=$3 RETURNING l.items,l.revision`,[id,hash,revision,JSON.stringify(items)]))[0];},
  };
}
export function createChannelHandler(options={}){
  const env=options.env??process.env,store=options.store??createChannelStore(env),limits=new Map();
  const publicRow=r=>({id:r.id,state:r.state,revision:r.revision,libraryRevision:r.library_revision??0,sandbox:channelTables(env).channels.endsWith('_preview'),updatedAt:r.updated_at});
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-content-type-options','nosniff');
    if(req.headers?.origin==='https://wendaar.github.io'){
      res.setHeader('access-control-allow-origin','https://wendaar.github.io');res.setHeader('vary','Origin');
      res.setHeader('access-control-allow-methods','GET, POST, PATCH, OPTIONS');res.setHeader('access-control-allow-headers','Content-Type, Authorization');
    }
    if(req.method==='OPTIONS')return res.status(200).json({});
    try{
      const id=req.query?.channel;
      if(req.method==='GET'){
        if(!channelId(id))throw new TypeError();const row=await store.get(id);
        return row?res.status(200).json(req.query?.library==='1'?await store.library(id):publicRow(row)):res.status(404).json({error:'Kanál nebyl nalezen.'});
      }
      if(!['POST','PATCH'].includes(req.method)){res.setHeader('allow','GET, POST, PATCH, OPTIONS');return res.status(405).json({error:'Nepovolená metoda.'});}
      if(!String(req.headers?.['content-type']??'').startsWith('application/json'))throw new TypeError();
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
      if(req.query?.library==='1'){
        if(req.method!=='PATCH'||!channelId(id)||!Number.isSafeInteger(body?.revision)||body.revision<0)throw new TypeError();
        if(Buffer.byteLength(JSON.stringify(body))>LIBRARY_BYTES+100)return res.status(413).json({error:'Knihovna je příliš velká. Maximum je 1,8 MB a 16 položek.'});
        const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers?.authorization??'')?.[1];if(!token)return res.status(403).json({error:'Chybí oprávnění ovládat kanál.'});
        const items=broadcastLibrary(body.items,env),saved=await store.saveLibrary(id,digest(token),body.revision,items);
        return saved?res.status(200).json(saved):res.status(409).json({error:'Knihovna nebyla uložena. Obnovte ovládání a zkuste to znovu.'});
      }
      if(JSON.stringify(body??{}).length>4096)throw new TypeError();
      const state=channelState(body?.state,env);
      if(req.method==='POST'){
        const key=digest(String(req.headers?.['x-forwarded-for']??req.socket?.remoteAddress??'unknown')),now=Date.now();
        const hits=(limits.get(key)??[]).filter(t=>t>now-60000);if(hits.length>=5)return res.status(429).json({error:'Zkuste to prosím za minutu.'});
        limits.set(key,[...hits,now]);if(limits.size>500)limits.delete(limits.keys().next().value);
        const newId=randomBytes(24).toString('hex'),controlKey=randomBytes(32).toString('hex');
        const row=await store.create(newId,digest(controlKey),state);return res.status(201).json({...publicRow(row),controlKey});
      }
      if(!channelId(id)||!Number.isSafeInteger(body.revision)||body.revision<1)throw new TypeError();
      const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers?.authorization??'')?.[1];
      if(!token)return res.status(403).json({error:'Chybí oprávnění ovládat kanál.'});
      const row=await store.update(id,digest(token),body.revision,state);
      return row?res.status(200).json(publicRow(row)):res.status(409).json({error:'Kanál nebyl změněn. Obnovte ovládání; kanál mohl změnit jiný ovladač.'});
    }catch(e){return res.status(e instanceof TypeError||e instanceof SyntaxError?400:503).json({error:e instanceof TypeError||e instanceof SyntaxError?'Neplatné nastavení kanálu.':'OBS kanál nyní není dostupný. Zkuste to znovu.'});}
  };
}
