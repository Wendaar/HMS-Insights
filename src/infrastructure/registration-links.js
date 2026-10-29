import {neon} from '@neondatabase/serverless';
import {createHash, randomBytes} from 'node:crypto';

export const registrationSchema = `
create table if not exists hms_registration_links (
 organization_id uuid not null, competition_id uuid not null, season_id uuid not null, team_id uuid not null,
 token_hash text not null unique check (length(token_hash)=64), revision integer not null default 1,
 created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
 primary key (organization_id,competition_id,season_id,team_id)
);
create table if not exists hms_registration_rate (
 bucket text primary key, attempts integer not null, expires_at timestamptz not null
);`;
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const validTeamToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
const columns = 'team_id, revision, created_at, expires_at, revoked_at';
const params = s => [s.organizationId, s.competitionId, s.seasonId];
export function registrationLinkStore({env = process.env, sql} = {}) {
  const production=env.VERCEL_ENV==='production';
  let ready;
  const query = async (text, values = []) => {
    if (!sql && !env.DATABASE_URL) throw Error('Registration storage unavailable');
    const isolated=production?text:text.replaceAll('hms_registration_links','hms_registration_links_preview').replaceAll('hms_registration_rate','hms_registration_rate_preview');
    return (sql ?? neon(env.DATABASE_URL)).query(isolated, values);
  };
  const init = async () => {
    if (!ready) ready = (async () => { for (const statement of registrationSchema.split(';').filter(s => s.trim())) await query(statement); })().catch(error => {ready = null; throw error;});
    return ready;
  };
  return {
    async list(scope) {
      await init(); return query(`select ${columns} from hms_registration_links where organization_id=$1 and competition_id=$2 and season_id=$3`, params(scope));
    },
    async resolve(token, scope) {
      if (!validTeamToken(token)) return null;
      await init();
      return (await query(`select ${columns} from hms_registration_links where token_hash=$4 and organization_id=$1 and competition_id=$2 and season_id=$3 and revoked_at is null and expires_at>now()`, [...params(scope), tokenHash(token)]))[0] ?? null;
    },
    async rotate(scope, teamId) {
      await init(); const token = randomBytes(32).toString('base64url');
      const rows = await query(`insert into hms_registration_links (organization_id,competition_id,season_id,team_id,token_hash,expires_at)
        values ($1,$2,$3,$4,$5,'2027-09-01T00:00:00Z')
        on conflict (organization_id,competition_id,season_id,team_id) do update set
        token_hash=excluded.token_hash,revision=hms_registration_links.revision+1,created_at=now(),expires_at=excluded.expires_at,revoked_at=null
        returning ${columns}`, [...params(scope),teamId,tokenHash(token)]);
      return {token, link: rows[0]};
    },
    async revoke(scope, teamId) {
      await init(); await query(`update hms_registration_links set revoked_at=now(),revision=revision+1 where organization_id=$1 and competition_id=$2 and season_id=$3 and team_id=$4`, [...params(scope),teamId]);
    },
    async rate(bucket, limit, now = Date.now()) {
      await init();
      // Fixed-size time buckets. No raw IPs or credentials are persisted.
      await query('delete from hms_registration_rate where expires_at<now()');
      const rows = await query(`insert into hms_registration_rate (bucket,attempts,expires_at) values ($1,1,$2)
        on conflict (bucket) do update set attempts=hms_registration_rate.attempts+1 returning attempts`, [bucket,new Date(now + 20 * 60 * 1000).toISOString()]);
      return rows[0].attempts <= limit;
    },
  };
}
