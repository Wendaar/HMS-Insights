import {readdir,readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {join,dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {organizationRegistry} from '../src/app/organizations.js';
import {mediaPath} from '../public/media-mapping/model.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
export async function buildMediaCatalog(root,organizations=organizationRegistry()){
  const folder=join(root,'public/media/audio'),assets=[];await mkdir(folder,{recursive:true});
  const owners=new Map([['shared','*'],...organizations.map(o=>[o.slug,o.code])]);
  async function walk(directory){for(const e of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,e.name),stat=await lstat(path);if(stat.isSymbolicLink())throw new Error('Media symlinks are not allowed');if(e.isDirectory()){await walk(path);continue;}
    if(!/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(e.name))continue;
    const rel=relative(folder,path).replaceAll('\\','/'),owner=owners.get(rel.split('/')[0]);if(!owner)throw new Error('Unknown media organization folder: '+rel);
    if(stat.size===0||stat.size>30*1024*1024)throw new Error('Audio must be 1 byte–30 MB: '+rel);
    const url=mediaPath('/media/audio/'+rel.split('/').map(encodeURIComponent).join('/'));if(!url)throw new Error('Invalid media file path: '+rel);
    const bytes=await readFile(path);assets.push({id:hash(rel).slice(0,24),title:e.name.replace(/\.[^.]+$/,'').replaceAll('_',' '),path:url,owner,bytes:bytes.length,checksum:hash(bytes),kind:'audio'});
    if(assets.length>1000)throw new Error('Media catalog limit exceeded');
  }}
  await walk(folder);assets.sort((a,b)=>a.path.localeCompare(b.path));const catalog={schemaVersion:1,revision:hash(JSON.stringify(assets)),assets};
  await writeFile(join(root,'public/media/catalog.json'),JSON.stringify(catalog,null,2)+'\n');return catalog;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const result=await buildMediaCatalog(root);console.log(`Media catalog: ${result.assets.length} audio files`);}
