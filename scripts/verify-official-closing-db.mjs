// Real PostgreSQL engine in memory; never connects to a configured database.
// Supply the @electric-sql/pglite entry point as argv[2], or install it locally.
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {toolStore,toolSchema} from '../src/infrastructure/tool-instances.js';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite(),sql={async query(text,values=[]){return (await db.query(text,values)).rows;}};
try{
 await db.exec(toolSchema);
 const store=toolStore({sql,tool:'official-closing-preview'});
 assert.equal(await store.closingHistoryReady(),false);
 await db.exec(await readFile(new URL('../db/migrations/009_official_closing.sql',import.meta.url),'utf8'));
 assert.equal(await store.closingHistoryReady(),true);
 const version={title:'Final',approval:{version:1},standings:[{teamId:'team-a',rank:1}]};
 const initial={config:{title:'Draft'},versions:[],locked:false,publishedVersion:null,events:[]};
 await store.save('PHM','final',initial,0,null);
 const approved={...initial,versions:[version],locked:true};await store.save('PHM','final',approved,1,null);
 await assert.rejects(()=>store.save('PHM','final',{...approved,versions:[{...version,title:'Tampered'}]},2,null),/immutable/);
 await assert.rejects(()=>store.save('PHM','final',{...approved,versions:[]},2,null),/Invalid Closing history append/);
 await assert.rejects(()=>db.query("delete from hms_tool_instances where tool=$1 and organization=$2 and slug=$3",['official-closing-preview','PHM','final']),/immutable/);
 const reopened={...approved,locked:false,events:[{action:'reopen',reason:'Correct reviewed placement'}]};
 await store.save('PHM','final',reopened,2,null);
 const second={...reopened,versions:[version,{...version,title:'Revised final',approval:{version:2}}],locked:true};
 const concurrent=await Promise.all([store.save('PHM','final',second,3,null),store.save('PHM','final',second,3,null)]);
 assert.equal(concurrent.filter(Boolean).length,1);
 await store.save('PHM','final',{...second,publishedVersion:1},4,null);
 const persisted=await store.get('PHM','final');assert.equal(persisted.draft.publishedVersion,1);assert.equal(persisted.draft.versions.length,2);
 assert.equal(await store.get('EUCHL','final'),null);
 const other=toolStore({sql,tool:'public-portal'});await other.save('PHM','main',{title:'Portal'},0,null);await other.save('PHM','main',{title:'Edited portal'},1,null);
 console.log('Closing PostgreSQL checks passed: migration readiness, append-only history, mutation/deletion rejection, concurrent CAS, version pointer, tenant and tool isolation.');
}finally{await db.close();}
