import {copyFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.argv[2]??join(root,'..','youtube-overlays-work'));
const destination=join(root,'public','broadcast');await mkdir(destination,{recursive:true});
await mkdir(join(destination,'fonts'),{recursive:true});
for(const name of ['index.html','app.js','styles.css','hms-source.js','i18n.js','channel.js','match-layers.js','fonts/barlow-latin.woff2','fonts/barlow-latin-ext.woff2','fonts/LICENSE.txt'])await copyFile(join(source,name),join(destination,name));
console.log('Opening Studio synchronizováno do public/broadcast.');
