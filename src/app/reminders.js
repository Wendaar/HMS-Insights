import {organizationConfig,organizationRegistry} from './organizations.js';
import {reminderConfig,matchPreview,invitation,invitationHtml,gameDay} from './game-day.js';
import {reminderStore} from '../infrastructure/reminder-store.js';
import {ecomailAdapter} from '../infrastructure/reminder-email.js';
import {timeWindow} from './media-engine.js';

// Replace this provider with an authenticated HMS API reader when available.
export const csvContactProvider={async recipients(settings,preview){return(settings.contacts??[]).filter(c=>[preview.home.id,preview.away.id].map(x=>x.toLowerCase()).includes(c.teamId));}};
export async function queueReminder(org,gameId,options={}) {
  const config=organizationConfig(org,options.env??process.env),store=options.store??reminderStore(options),settings=await store.settings(config.id),policy=reminderConfig(settings?.config);
  if(!policy.enabled)throw new TypeError('Reminders disabled');
  const p=await(options.preview??matchPreview)(config.code,gameId,options);
  const start=fixtureInstant(p.date,p.time);
  if(!p.eligible||start===null||start<=(options.now??new Date()).getTime())throw new TypeError('Fixture already started or unavailable');
  const jerseys={};for(const side of ['home','away']){const color=options.jerseys?.[side];if(color!==undefined&&color!==''&&!/^#[a-f0-9]{6}$/i.test(color))throw new TypeError('Invalid jersey');if(color)jerseys[side]=color;}
  const contacts=await(options.contacts??csvContactProvider).recipients(settings??{},p);
  const recipients=[...new Set(contacts.filter(c=>!policy.recipientTeamIds.length||policy.recipientTeamIds.includes(c.teamId)).map(c=>c.email))];
  let queued=0;for(const recipient of recipients)queued+=await store.enqueue(config.id,gameId,recipient,{preview:p,text:invitation(p,{...policy,jerseys}),html:invitationHtml(p,{...policy,jerseys}),branding:policy.branding,jerseys});
  return {queued,recipients:recipients.length,mode:'test'};
}
export async function processReminders(org,options={}) {
  const config=organizationConfig(org,options.env??process.env),store=options.store??reminderStore(options),email=options.email??ecomailAdapter();
  let processed=0;for(let i=0;i<20;i++){const job=await store.claim(config.id);if(!job)break;
    try{const result=await email.send({to:job.recipient,...job.payload,idempotencyKey:String(job.id)});if(result.outcome!=='simulated')throw Error('Unexpected delivery');await store.finish(job,'simulated');}catch{await store.finish(job,'provider-failed');}processed++;
  }return {processed,mode:'test'};
}
// Local calendar conversion validates nonexistent DST times; ambiguous times fail
// closed as well. HMS starts are Europe/Prague wall-clock times, not UTC.
export function fixtureInstant(date,time){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||!/^\d{2}:\d{2}(?::\d{2})?$/.test(time??''))return null;
  const target=`${date} ${time.slice(0,5)}`,base=Date.parse(`${date}T${time.slice(0,5)}:00Z`),matches=[];
  const f=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  for(const hours of [1,2]){const instant=base-hours*3600000;if(Number.isFinite(instant)&&f.format(new Date(instant))===target)matches.push(instant);}
  return matches.length===1?matches[0]:null;
}
export async function scheduleReminders(options={}) {
  const env=options.env??process.env,store=options.store??reminderStore(options),results=[];
  for(const entry of organizationRegistry(env)){
    let config;try{config=organizationConfig(entry.code,env);}catch{continue;}
    try{const policy=reminderConfig((await store.settings(config.id))?.config);if(!policy.enabled||!policy.automatic)continue;
      const now=options.now??new Date(),today=timeWindow('Today',now).from;let queued=0;
      // 8 calendar days, max 100 fixtures/day. Abort instead of silently dropping overflow.
      for(let d=0;d<8;d++){const at=new Date(today+'T12:00:00Z');at.setUTCDate(at.getUTCDate()+d);const date=at.toISOString().slice(0,10);let offset=0;
        for(let page=0;page<5;page++){const data=await(options.day??gameDay)(config.code,{date,offset},options);
          for(const p of data.items){const starts=fixtureInstant(p.date,p.time),kind=policy.competitionTypes[p.competitionId]??'league',lead=policy.schedule[kind]*3600000;
            if(p.eligible&&starts!==null&&starts>now.getTime()&&starts-lead<=now.getTime())queued+=(await queueReminder(config.code,p.gameId,{...options,store})).queued;}
          if(!data.hasMore)break;if(page===4)throw Error('Daily fixture limit');offset+=20;
        }
      }
      results.push({org:config.code,queued,...await processReminders(config.code,{...options,store})});
    }catch{results.push({org:entry.code,error:'reminder-run-unavailable'});}
  }return {results,mode:'test'};
}
