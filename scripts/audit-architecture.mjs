// Read-only source census; writes documentation evidence only. No network/env reads.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {posix} from 'node:path';
const sourceRef=process.argv[2]??'43142e6a1bd53e2dd762860400feaf072f76897b';
const files=execFileSync('git',['ls-tree','-rz','--name-only',sourceRef],{encoding:'utf8'}).split('\0').filter(Boolean);
const textFiles=files.filter(p=>/\.(js|mjs|json|sql|md|yaml|html|css)$/.test(p)||p==='.env.example');
const refs=[],imports=[],timers=[],storage=[],env=[],docs=[],requests=[];
for(const file of textFiles){
 const text=readFileSync(file,'utf8');
 if(file.startsWith('docs/')&&file.endsWith('.md'))docs.push({file,heading:text.split(/\r?\n/).find(l=>l.startsWith('#'))??'',lines:text.split(/\r?\n/).length});
 text.split(/\r?\n/).forEach((line,i)=>{
  const at={file,line:i+1};
  if(!file.endsWith('.md')&&/fetch\s*\(|\/api\/|XMLHttpRequest|EventSource|WebSocket/.test(line))requests.push({...at,text:line.trim()});
  for(const m of line.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)){const target=m[1];imports.push({...at,target,resolved:target.startsWith('.')?posix.normalize(posix.join(posix.dirname(file),target)):null});}
  if(/setInterval|setTimeout|visibilitychange|visibilityState|document\.hidden|Retry-After|retry-after|backoff/i.test(line))timers.push({...at,text:line.trim()});
  if(/create\s+table|\b(?:from|into|update|join)\s+(?:hms_|broadcast_|hero_|games\b|player_game|goalie_game|team_game|detected_|pregame_)|toolStore\(|StorageNamespace|mediaTool|channelTables|cameraTable/i.test(line))storage.push({...at,text:line.trim()});
  for(const m of line.matchAll(/\b(?:env|process\.env)\.([A-Z][A-Z0-9_]*)/g))env.push({...at,name:m[1]});
  if(!file.endsWith('.md'))for(const m of line.matchAll(/https?:\/\/[^\s'"`<>)}]+/g)){try{refs.push({...at,host:new URL(m[0]).host});}catch{}}
 });
}
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const data={sourceRef,scope:'File list pinned to sourceRef; contents read from current checkout. Run on a compatible checkout. Static references, not runtime telemetry. Dynamic imports/SQL/env names require manual review.',counts:{files:files.length,textFiles:textFiles.length,api:files.filter(p=>p.startsWith('api/')).length,rewrites:config.rewrites.length,redirects:config.redirects.length,headers:config.headers.length},files,documentation:docs,api:files.filter(p=>p.startsWith('api/')),config,imports,timers,storage,requestReferences:requests,environmentReferences:env,externalHostReferences:refs};
mkdirSync('docs/architecture-evidence',{recursive:true});
writeFileSync('docs/architecture-evidence/inventory.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data.counts));
