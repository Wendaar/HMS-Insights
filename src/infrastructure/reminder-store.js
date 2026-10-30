import {neon} from '@neondatabase/serverless';
export function reminderStore({env=process.env,sql}={}) {
  const query=(text,args=[])=>{if(!sql&&!env.DATABASE_URL)throw new Error('Reminder storage unavailable');return(sql??neon(env.DATABASE_URL)).query(text,args);};
  return {
    async settings(org){return(await query('select config,contacts from hms_reminder_settings where organization=$1::uuid',[org]))[0]??null;},
    async save(org,config){await query(`insert into hms_reminder_settings(organization,config) values($1::uuid,$2::jsonb) on conflict(organization) do update set config=excluded.config,updated_at=now()`,[org,JSON.stringify(config)]);},
    async contacts(org,contacts){await query(`insert into hms_reminder_settings(organization,config,contacts) values($1::uuid,'{}',$2::jsonb) on conflict(organization) do update set contacts=excluded.contacts,updated_at=now()`,[org,JSON.stringify(contacts)]);},
    async enqueue(org,game,recipient,payload){return(await query(`insert into hms_reminder_jobs(organization,game_id,recipient,mode,payload) values($1::uuid,$2::uuid,$3,'test',$4::jsonb) on conflict do nothing returning id`,[org,game,recipient,JSON.stringify(payload)])).length;},
    async log(org){return query(`select j.id,j.game_id,j.recipient,j.status,j.mode,j.attempts,j.updated_at,j.payload->>'text' as preview_text,coalesce((select jsonb_agg(jsonb_build_object('attempt',a.attempt,'outcome',a.outcome,'at',a.created_at) order by a.id) from hms_reminder_attempts a where a.job_id=j.id),'[]') as log from hms_reminder_jobs j where j.organization=$1::uuid order by j.id desc limit 100`,[org]);},
    async claim(org){
      await query(`with expired as (update hms_reminder_jobs set status='failed',updated_at=now() where organization=$1::uuid and status='processing' and attempts>=3 and updated_at<now()-interval '5 minutes' returning id,attempts) insert into hms_reminder_attempts(job_id,attempt,outcome) select id,attempts,'worker-expired' from expired`,[org]);
      return(await query(`update hms_reminder_jobs set status='processing',attempts=attempts+1,updated_at=now() where id=(select id from hms_reminder_jobs where organization=$1::uuid and attempts<3 and ((status in ('queued','retry') and available_at<=now()) or (status='processing' and updated_at<now()-interval '5 minutes')) order by id for update skip locked limit 1) returning *`,[org]))[0];
    },
    async finish(job,outcome){await query(`with changed as (update hms_reminder_jobs set status=$3,available_at=now()+make_interval(secs=>60*power(2,attempts)::int),updated_at=now() where id=$1 and status='processing' and attempts=$2 returning id) insert into hms_reminder_attempts(job_id,attempt,outcome) select id,$2,$4 from changed`,[job.id,job.attempts,outcome==='simulated'?'simulated':job.attempts>=3?'failed':'retry',outcome]);},
    async retry(org,id){return(await query(`update hms_reminder_jobs set status='queued',attempts=0,available_at=now(),updated_at=now() where organization=$1::uuid and id=$2 and status='failed' returning id`,[org,id])).length;},
  };
}
