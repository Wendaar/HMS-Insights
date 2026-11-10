#!/usr/bin/env node
import {readFile, mkdir, writeFile, mkdtemp} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fetchAlbum, resolveAlbum} from './flickr.mjs';
import {fetchLineup} from './lineup.mjs';
import {analyzePhoto} from './vision.mjs';
import {suggestPlayers} from './matcher.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const usage = `HMS Photo Archive (Node 20+)\nUsage: node photo-archive/pilot.mjs [options]\n  --limit N          Photos per case, 1..500 (default 25)\n  --case N           One of the four pilot cases (default all)\n  --resolve-only     Public Flickr link resolution only; no API keys needed\n  --offline          Report configuration without network requests\n  --analyze          Analyze previews and propose roster candidates\n  --vision-limit N   Maximum image calls across the run, 1..25 (default 3)\n  --out PATH         Local output root (default photo-archive/out)\n  --help             Help without network or file writes\nExit: 0 all requested stages passed, 1 failed/blocked stage, 2 invalid invocation.\n`;

export function parseArgs(args) {
  const options = {limit:25,visionLimit:3,out:join(here,'out')};
  const flags = {'--resolve-only':'resolveOnly','--offline':'offline','--analyze':'analyze','--help':'help'};
  const values = {'--limit':['limit',500],'--case':['caseNumber',4],'--vision-limit':['visionLimit',25],'--out':['out']};
  const seen = new Set();
  for (let i=0; i<args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Duplicate option ${arg}`);
    seen.add(arg);
    if (Object.hasOwn(flags,arg)) options[flags[arg]] = true;
    else if (Object.hasOwn(values,arg)) {
      const [key,max] = values[arg], value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (max && (!/^[1-9]\d*$/.test(value) || Number(value)>max)) throw new Error(`Invalid value for ${arg}: expected 1..${max}`);
      options[key] = max ? Number(value) : resolve(value);
    } else throw new Error(`Unknown option ${arg}`);
  }
  if (options.resolveOnly && (options.offline || options.analyze)) throw new Error('--resolve-only cannot combine with --offline or --analyze');
  if (seen.has('--vision-limit') && !options.analyze) throw new Error('--vision-limit requires --analyze');
  return options;
}

function safeError(error, env) {
  let message = String(error?.message || 'Request failed');
  for (const key of ['HMS_API_TOKEN','FLICKR_API_KEY','OPENAI_API_KEY']) {
    if (env[key]) message = message.replaceAll(env[key], '[redacted]');
  }
  return message.includes('fetch failed') ? 'Network request failed' : message;
}

export async function runPilot(options, {env=process.env,fetchImpl=fetch,log=console.log} = {}) {
  const cases = JSON.parse(await readFile(join(here,'pilot-cases.json'),'utf8'));
  await mkdir(options.out,{recursive:true});
  const out = await mkdtemp(join(options.out,'run-'));
  const summary = [];
  let calls = 0;
  const capture = async fn => {
    try {return {ok:true,...await fn()};} catch (err) {return {ok:false,error:safeError(err,env)};}
  };
  for (const [index,item] of cases.entries()) {
    if (options.caseNumber && options.caseNumber !== index+1) continue;
    const result = {case:index+1,gameId:item.gameId,org:item.org,flickrAlbum:item.flickrAlbum};
    let lineup, album, resolved;
    const save = (suffix,data) => writeFile(join(out,`case-${index+1}-${suffix}.json`),JSON.stringify(data,null,2));
    result.resolution = options.offline ? {ok:false,error:'Offline mode: link resolution not attempted'} : await capture(async()=>{
      resolved = await resolveAlbum(item.flickrAlbum,{fetchImpl});
      return resolved;
    });
    if (!options.resolveOnly) {
      result.hms = await capture(async()=>{
        if (!env.HMS_API_TOKEN?.trim()) throw new Error('Missing HMS_API_TOKEN');
        if (options.offline) throw new Error('Offline mode: HMS not attempted');
        lineup = await fetchLineup(item.gameId,{env,fetchImpl});
        await save('lineup',lineup);
        return {players:lineup.players.length,withNumbers:lineup.players.filter(p=>p.jerseyNumber!==null).length};
      });
      result.flickr = await capture(async()=>{
        if (!env.FLICKR_API_KEY?.trim()) throw new Error('Missing FLICKR_API_KEY');
        if (options.offline) throw new Error('Offline mode: Flickr API not attempted');
        if (!resolved) throw new Error('Blocked by album resolution failure');
        album = await fetchAlbum(item.flickrAlbum,{env,fetchImpl,limit:options.limit,resolved});
        await save('photos',album);
        return {albumId:album.photosetId,total:album.total,sampled:album.photos.length};
      });
      if (options.analyze) result.vision = await capture(async()=>{
        if (!env.OPENAI_API_KEY?.trim()) throw new Error('Missing OPENAI_API_KEY');
        if (!env.PHOTO_VISION_MODEL?.trim()) throw new Error('Missing PHOTO_VISION_MODEL');
        if (options.offline) throw new Error('Offline mode: vision not attempted');
        if (!album || !lineup) throw new Error('Blocked by missing photos or lineup');
        const analyses = [];
        for (const photo of album.photos) {
          if (calls >= options.visionLimit) break;
          const analysis = await capture(async()=>{
            if (!photo.previewUrl) throw new Error('Photo has no preview URL');
            calls++;
            const observed = await analyzePhoto(photo.previewUrl,{env,fetchImpl});
            return {...observed,suggestions:suggestPlayers(lineup.players,observed.observations)};
          });
          analyses.push({photoId:photo.id,...analysis});
        }
        await save('analysis',analyses);
        if (!analyses.length) throw new Error(calls>=options.visionLimit ? 'Global vision call limit reached: case not analyzed' : 'No photos to analyze');
        const failed = analyses.filter(a=>!a.ok).length;
        return {ok:failed===0,...(failed?{error:`${failed} photo analyses failed; see case analysis file`}:{}),
          attempted:analyses.length,analyzed:analyses.length-failed,requiresHumanReview:true};
      });
    }
    summary.push(result);
    log(`Case ${index+1}: `+Object.entries(result).filter(([,v])=>v && typeof v === 'object' && 'ok' in v).map(([k,v])=>`${k} ${v.ok?'OK':v.error || 'FAILED'}`).join('; '));
  }
  const report = {generatedAt:new Date().toISOString(),mode:options.resolveOnly?'resolve-only':options.offline?'offline':'live',visionCalls:calls,summary};
  await writeFile(join(out,'summary.json'),JSON.stringify(report,null,2));
  log(`Saved local report: ${join(out,'summary.json')}`);
  return summary.every(r=>Object.values(r).every(v=>!v || typeof v !== 'object' || !('ok' in v) || v.ok)) ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let options;
  try {options = parseArgs(process.argv.slice(2));} catch (err) {console.error(err.message);process.exitCode=2;}
  if (options?.help) console.log(usage);
  else if (options) {
    try {process.exitCode = await runPilot(options);} catch (err) {console.error(safeError(err,process.env));process.exitCode=1;}
  }
}
