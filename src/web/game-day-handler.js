import {gameDay,matchPreview,managerContacts,reminderConfig} from '../app/game-day.js';
import {queueReminder,processReminders,scheduleReminders} from '../app/reminders.js';
import {reminderStore} from '../infrastructure/reminder-store.js';
import {organizationConfig} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
export function createGameDayHandler(options={}) {
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const env=options.env??process.env,q=req.query??{},action=q.action??'day';
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  try{
   if(action==='cron'){
    if(req.method!=='GET')return res.status(405).json({error:'GET required'});
    if(!env.CRON_SECRET||env.CRON_SECRET.length<16||!hasBearerSecret(req,env.CRON_SECRET))return res.status(401).json({error:'Unauthorized'});
    return res.status(200).json(await(options.schedule??scheduleReminders)({...options,env}));
   }
   const config=organizationConfig(q.org,env);
   if(req.method==='GET'&&action==='day')return res.status(200).json(await(options.day??gameDay)(config.code,q,options));
   if(req.method==='GET'&&action==='preview')return res.status(200).json(await(options.preview??matchPreview)(config.code,q.gameId,options));
   // Dedicated per-organization capability, never HMS API or shared cron credentials.
   const secret=env[`HMS_${config.code}_REMINDER_SECRET`];
   if(!secret||secret.length<24||!hasBearerSecret(req,secret))return res.status(401).json({error:'Reminder Center requires an organization access key'});
   const store=options.store??reminderStore(options);
   if(req.method==='GET'&&action==='center'){const settings=await store.settings(config.id);return res.status(200).json({config:reminderConfig(settings?.config),contacts:settings?.contacts??[],jobs:await store.log(config.id),mode:'test'});}
   if(req.method!=='POST')return res.status(400).json({error:'Unknown action'});
   if(Number(req.headers?.['content-length']??0)>250000||typeof req.body==='string'&&Buffer.byteLength(req.body)>250000)return res.status(413).json({error:'Body too large'});
   let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body??{};}catch{return res.status(400).json({error:'Invalid JSON'});}
   if(body.mode&&body.mode!=='test')return res.status(400).json({error:'Production delivery disabled'});
   if(action==='config'){await store.save(config.id,reminderConfig(body));return res.status(200).json({saved:true,mode:'test'});}
   if(action==='contacts'){const contacts=managerContacts(body.csv,config.id);await store.contacts(config.id,contacts);return res.status(200).json({imported:contacts.length,mode:'test'});}
   if(action==='queue')return res.status(200).json(await queueReminder(config.code,body.gameId,{...options,store,jerseys:body.jerseys}));
   if(action==='process')return res.status(200).json(await processReminders(config.code,{...options,store}));
   if(action==='retry'){if(!/^\d{1,15}$/.test(String(body.id)))throw new TypeError('Invalid job');return res.status(200).json({retried:await store.retry(config.id,body.id)});}
   return res.status(400).json({error:'Unknown action'});
  }catch(e){return res.status(e instanceof TypeError?400:503).json({error:e instanceof TypeError?'Check input, organization, date and reminder configuration.':'Game Day data or reminder storage unavailable.'});}
 };
}
