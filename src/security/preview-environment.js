// Preview has its own project, empty database and credentials. Production is a no-op.
const productionProject='prj_BlCu86WpDG3wOoF6BC3GGpMJccHw';
const urlKeys=['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','POSTGRES_PRISMA_URL','POSTGRES_URL_NON_POOLING','POSTGRES_URL_NO_SSL'];
const hostKeys=['PGHOST','PGHOST_UNPOOLED','POSTGRES_HOST'];
const normalizeHost=host=>host.toLowerCase().replace(/-pooler(?=\.)/,'');
export class PreviewIsolationError extends Error {
  constructor(){super('Preview isolation is not configured. Production credentials are not permitted.');this.code='HMS_PREVIEW_ISOLATION_REQUIRED';}
}
export function assertPreviewEnvironment(env=process.env){
  if(env.VERCEL_ENV!=='preview')return {enforced:false};
  const fail=()=>{throw new PreviewIsolationError();};
  const project=env.HMS_PREVIEW_PROJECT_ID,host=env.HMS_PREVIEW_DATABASE_HOST;
  if(!project||project===productionProject||env.VERCEL_PROJECT_ID!==project||!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host??''))fail();
  if(env.HMS_PREVIEW_DATABASE_USER!=='hms_preview_app'||env.HMS_PREVIEW_DATABASE_NAME!=='hms_preview')fail();
  const checkUrl=value=>{let u,user,path;try{u=new URL(value);user=decodeURIComponent(u.username);path=decodeURIComponent(u.pathname);}catch{fail();}
    if(!['postgres:','postgresql:'].includes(u.protocol)||u.port&&u.port!=='5432'||normalizeHost(u.hostname)!==normalizeHost(host)||user!=='hms_preview_app'||path!=='/hms_preview'||!u.password||!['require','verify-full'].includes(u.searchParams.get('sslmode')))fail();
  };
  if(!env.DATABASE_URL)fail();
  for(const key of urlKeys)if(env[key])checkUrl(env[key]);
  for(const key of hostKeys)if(env[key]&&normalizeHost(env[key])!==normalizeHost(host))fail();
  for(const key of ['PGUSER','POSTGRES_USER'])if(env[key]&&env[key]!=='hms_preview_app')fail();
  for(const key of ['PGDATABASE','POSTGRES_DATABASE'])if(env[key]&&env[key]!=='hms_preview')fail();
  // No live upstream or provisioning credentials in this fixture-only Preview.
  for(const [key,value] of Object.entries(env)){
    if(!value)continue;
    if(/^(HMS(?:_[A-Z0-9]+)*_API_TOKEN|OPENAI_API_KEY|BLOB_READ_WRITE_TOKEN|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|NEON_API_KEY|FLICKR_API_KEY|FLICKT_API_KEY|ECOMAIL_API_KEY|CRON_SECRET)$/.test(key)||key.startsWith('HMS_BOOTSTRAP'))fail();
    if(/^(HMS(?:_[A-Z0-9]+)*_SECRET)$/.test(key)&&!value.startsWith('hms-preview-'))fail();
  }
  return {enforced:true,project,host:normalizeHost(host),database:'hms_preview',user:'hms_preview_app'};
}
assertPreviewEnvironment();
