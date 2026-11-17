import '../src/security/preview-environment.js';
import {assertPreviewEnvironment} from '../src/security/preview-environment.js';
if(process.env.VERCEL_ENV!=='preview')throw new Error('Run this check only with the isolated Preview environment. No changes were made.');
console.log(JSON.stringify(assertPreviewEnvironment(),null,2));
