import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {buildMediaCatalog} from './build-media-catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url));
await buildMediaCatalog(root);
await build({absWorkingDir:root,entryPoints:['src/browser/media-blob-upload.js'],outfile:'public/media-mapping/blob-client.js',bundle:true,platform:'browser',format:'esm',target:['es2020'],minify:true,legalComments:'eof'});
console.log('Media catalog and direct Blob upload client built.');
