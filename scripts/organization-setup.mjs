// Run only in a trusted shell with server-side environment variables already set.
// Never pass secrets as command-line arguments. Default is a read-only identity check.
import {organizationConfig} from '../src/app/organizations.js';
import {fetchOrganization,hmsConfigFromEnv} from '../src/hms/client.js';
import {backfillFinishedGames} from '../src/app/backfill-finished-games.js';
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
try{
  if(!args.includes('--org'))throw new Error();
  const org=organizationConfig(arg('--org'));
  if(!org.token)throw new Error();
  const config=hmsConfigFromEnv({...process.env,HMS_API_TOKEN:org.token});
  const identity=await fetchOrganization({config:{...config,timeoutMs:5000,retries:0}});
  if(identity?.organizationId?.toLowerCase()!==org.id.toLowerCase())throw new Error();
  console.log(`Organization ${org.code}: HMS identity verified. Studio path /studio/${org.slug}`);
  if(args.includes('--import')){
    const from=arg('--from'),to=arg('--to'),valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d??'')&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
    if(!process.env.DATABASE_URL||!args.includes('--from')||!args.includes('--to')||!valid(from)||!valid(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>30)throw new Error();
    const result=await backfillFinishedGames({config,organizationId:org.id,from,to,limit:10,intervalMs:1800,onProgress:({processed,failed})=>console.log(`Imported: ${processed}; failed: ${failed}`)});
    console.log(`Complete: ${result.processed} imported, ${result.failed} failed.`);
    if(result.failed)process.exitCode=1;
  }
}catch{console.error('Organization setup failed. Check the registry, scoped credentials, HMS permissions, and --org. History import also requires DATABASE_URL and a valid --from/--to window of at most 31 calendar days. No credentials or upstream errors are printed.');process.exitCode=1;}
