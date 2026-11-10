import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {buildMediaCatalog} from './build-media-catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url));
await buildMediaCatalog(root);
await build({absWorkingDir:root,entryPoints:['src/browser/media-blob-upload.js'],outfile:'public/media-mapping/blob-client.js',bundle:true,platform:'browser',format:'esm',target:['es2020'],minify:true,legalComments:'eof'});
console.log('Media catalog and direct Blob upload client built.');
if(process.env.VERCEL_ENV==='production' && (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-archive-releasecheck]')){
  const {checkProductionArchive}=await import('../photo-archive/picker-readcheck.mjs');await checkProductionArchive();
}
// Pilot branch only: bounded, read-only ingestion check with Preview-only secrets.
if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'codex/hms-photo-archive-pilot') {
  const {runPreviewCheck}=await import('../photo-archive/preview-check.mjs');
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-api-fields]')){const {checkArchiveHmsFields}=await import('../photo-archive/hms-fields-check.mjs');await checkArchiveHmsFields();}
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-older-check]')){const {checkOlderArchive}=await import('../photo-archive/hms-fields-check.mjs');await checkOlderArchive();}
  // Explicit commit marker keeps ordinary builds from spending image-model credits.
  await runPreviewCheck({analyze:(process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-vision-test]'),expectedModel:'gpt-6-luna'});
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-review-seed]')){
    const {seedReviewArchive}=await import('../photo-archive/seed-review.mjs');
    await seedReviewArchive();
  }
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-album-ai-smoke]')){
    const {smokeAlbumAnalysis}=await import('../photo-archive/album-ai-smoke.mjs');
    await smokeAlbumAnalysis();
  }
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-context-smoke]')){
    const {smokeJerseyContext}=await import('../photo-archive/context-smoke.mjs');
    await smokeJerseyContext();
  }
  if((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[photo-picker-readcheck]')){
    const {checkGeneralArchive}=await import('../photo-archive/picker-readcheck.mjs');await checkGeneralArchive();
  }
}
