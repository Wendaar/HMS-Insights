import {neon} from '@neondatabase/serverless';
import {portalCatalog,portalDirectory} from '../app/public-portal.js';
import {REGISTRATION_SCOPE,sameId} from '../app/registration-control.js';
import {sportingImage} from '../../public/game-report-media.js';
export const snapshotSchema=`create table if not exists hms_registration_snapshots (
 organization_id uuid not null,competition_id uuid not null,season_id uuid not null,
 revision integer not null,payload jsonb not null,uploaded_at timestamptz not null default now(),
 primary key(organization_id,competition_id,season_id))`;
const params=s=>[s.organizationId,s.competitionId,s.seasonId];
export function registrationSnapshotStore({env=process.env,sql}={}){
 let ready;
 const query=async(text,values=[])=>{if(!sql&&!env.DATABASE_URL)throw Error('Storage unavailable');const isolated=env.VERCEL_ENV==='production'?text:text.replaceAll('hms_registration_snapshots','hms_registration_snapshots_preview');return (sql??neon(env.DATABASE_URL)).query(isolated,values);};
 const init=()=>ready??=(query(snapshotSchema).catch(e=>{ready=null;throw e;}));
 return {
  async get(scope){await init();const row=(await query('select revision,payload,uploaded_at from hms_registration_snapshots where organization_id=$1 and competition_id=$2 and season_id=$3',params(scope)))[0];
   if(!row)return null;const s=row.payload?.scope;if(!s||!params(scope).every((id,i)=>sameId(id,params(s)[i])))throw Error('Snapshot scope mismatch');
   return {revision:row.revision,payload:row.payload,uploadedAt:row.uploaded_at};},
  async save(scope,payload,revision){await init();
   const {pending,...stored}=payload;
   if(revision>0){const updated=await query(`update hms_registration_snapshots set payload=$4::jsonb,revision=revision+1,uploaded_at=now()
     where organization_id=$1 and competition_id=$2 and season_id=$3 and revision=$5 returning revision,uploaded_at`,[...params(scope),JSON.stringify(stored),revision]);return updated[0]??null;}
   const rows=await query(`insert into hms_registration_snapshots (organization_id,competition_id,season_id,payload,revision)
    values ($1,$2,$3,$4::jsonb,1) on conflict do nothing returning revision,uploaded_at`,[...params(scope),JSON.stringify(stored)]);
   return rows[0]??null;
  }
 };
}
export async function registrationTeamCatalog(options={}){
 const catalog=await portalCatalog('PHM',options);
 if(!catalog.items.some(s=>sameId(s.seasonId,REGISTRATION_SCOPE.seasonId)&&sameId(s.competitionId,REGISTRATION_SCOPE.competitionId)))throw Error('Season identity mismatch');
 return (await portalDirectory('PHM',REGISTRATION_SCOPE.seasonId,options)).teams;
}
export async function registrationPortraits(team,options={}){
 const env=options.env??process.env;if(!env.DATABASE_URL&&!options.sql)return team;
 const sql=options.sql??neon(env.DATABASE_URL),ids=team.players.map(p=>p.playerId);
 if(!ids.length)return team;
 const rows=await sql.query(`select distinct on (player_id) player_id,image_url from (
  select p.player_id,coalesce(to_jsonb(p)->>'player_image_template_url',to_jsonb(p)->>'player_image_url') as image_url,g.played_on
  from player_game_stats p join games g on g.game_id=p.game_id
  where g.organization_id=$1::uuid and g.season_id=$2::uuid and p.team_id=$3::uuid and p.player_id=any($4::uuid[])
  union all
  select p.player_id,coalesce(to_jsonb(p)->>'player_image_template_url',to_jsonb(p)->>'player_image_url'),g.played_on
  from goalie_game_stats p join games g on g.game_id=p.game_id
  where g.organization_id=$1::uuid and g.season_id=$2::uuid and p.team_id=$3::uuid and p.player_id=any($4::uuid[])
 ) media where image_url is not null order by player_id,played_on desc`,[REGISTRATION_SCOPE.organizationId,REGISTRATION_SCOPE.seasonId,team.teamId,ids]);
 const photos=new Map(rows.map(r=>[r.player_id.toLowerCase(),sportingImage(r.image_url)]));
 return {...team,players:team.players.map(p=>({...p,photoUrl:photos.get(p.playerId)??null}))};
}
