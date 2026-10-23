import {randomBytes,createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {organizationConfig} from '../app/organizations.js';
import {isGameId} from '../domain/game-summary.js';
export const channelId=v=>typeof v==='string'&&/^[a-f0-9]{48}$/.test(v);
const digest=v=>createHash('sha256').update(v).digest('hex');
export function channelState(value,env){
  if(!value||!['PHM','EUCHL'].includes(value.org)||!isGameId(value.gameId)||!organizationConfig(value.org,env).token
    ||!['cs','en'].includes(value.lang)||!['opening','periods','lineup','scoresheet','insights'].includes(value.layer)
    ||!['home','away','both'].includes(value.side)||!['current','1','2','3'].includes(value.period)
    ||!Number.isInteger(value.page)||value.page<1||value.page>50||typeof value.visible!=='boolean'
    ||value.insight!==''&&!isGameId(value.insight))throw new TypeError('Invalid channel state');
  return Object.fromEntries(['org','gameId','lang','layer','side','period','page','insight','visible'].map(k=>[k,value[k]]));
}
export function createChannelStore(env){
  let sql,ready;
  async function db(){
    if(!env.DATABASE_URL)throw new Error('No channel database');
    sql??=neon(env.DATABASE_URL);
    ready??=sql.query(`CREATE TABLE IF NOT EXISTS broadcast_channels (id text PRIMARY KEY, control_hash text NOT NULL, state jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now())`).catch(e=>{ready=null;throw e;});
    await ready;return sql;
  }
  return {
    async create(id,hash,state){const dbsql=await db();const rows=await dbsql.query('INSERT INTO broadcast_channels (id,control_hash,state) VALUES ($1,$2,$3::jsonb) RETURNING id,state,revision,updated_at',[id,hash,JSON.stringify(state)]);return rows[0];},
    async get(id){const dbsql=await db();return (await dbsql.query('SELECT id,state,revision,updated_at FROM broadcast_channels WHERE id=$1',[id]))[0];},
    async update(id,hash,revision,state){const dbsql=await db();return (await dbsql.query('UPDATE broadcast_channels SET state=$4::jsonb,revision=revision+1,updated_at=now() WHERE id=$1 AND control_hash=$2 AND revision=$3 RETURNING id,state,revision,updated_at',[id,hash,revision,JSON.stringify(state)]))[0];},
  };
}
export function createChannelHandler(options={}){
  const env=options.env??process.env,store=options.store??createChannelStore(env),limits=new Map();
  const publicRow=r=>({id:r.id,state:r.state,revision:r.revision,updatedAt:r.updated_at});
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
        return row?res.status(200).json(publicRow(row)):res.status(404).json({error:'Kanál nebyl nalezen.'});
      }
      if(!['POST','PATCH'].includes(req.method)){res.setHeader('allow','GET, POST, PATCH, OPTIONS');return res.status(405).json({error:'Nepovolená metoda.'});}
      if(!String(req.headers?.['content-type']??'').startsWith('application/json'))throw new TypeError();
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
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
