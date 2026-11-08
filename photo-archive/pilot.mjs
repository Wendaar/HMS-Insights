#!/usr/bin/env node
// Read-only HMS + Flickr ingestion pilot; Node 20+.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(await readFile(join(here, 'pilot-cases.json'), 'utf8'));
const limit = Math.min(500, Math.max(1, Number(process.argv[process.argv.indexOf('--limit') + 1]) || 25));
const out = join(here, 'out');
await mkdir(out, { recursive: true });

function fail(message) { throw new Error(message); }
async function get(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), redirect: 'follow' });
  if (!response.ok) fail('HTTP ' + response.status + ' at ' + new URL(response.url).hostname);
  return response;
}
async function flickr(method, params) {
  const key = process.env.FLICKR_API_KEY;
  if (!key) fail('Missing FLICKR_API_KEY');
  const url = new URL('https://www.flickr.com/services/rest/');
  for (const [k,v] of Object.entries({method, api_key:key, format:'json', nojsoncallback:'1', ...params})) url.searchParams.set(k, String(v));
  const response = await get(url);
  const data = await response.json();
  if (data.stat !== 'ok') fail('Flickr: ' + (data.message || data.code || 'unknown error'));
  return data;
}
async function fetchAlbum(photoSetUrl) {
  const landing = await get(photoSetUrl);
  const canonical = landing.url;
  const match = canonical.match(/\/photos\/[^/]+\/albums\/(\d+)/) || canonical.match(/\/photos\/[^/]+\/sets\/(\d+)/);
  if (!match) fail('Flickr short link did not resolve to a canonical numeric album ID: ' + new URL(canonical).pathname);
  const photosetId = match[1];
  let page = 1, photos = [], total = 0;
  do {
    const data = await flickr('flickr.photosets.getPhotos', {photoset_id:photosetId, page, per_page:Math.min(limit,500), extras:'url_sq,url_m,url_z,date_taken,owner_name'});
    const set = data.photoset || {};
    total = Number(set.total || 0);
    photos.push(...(set.photo || []).map(p => ({
      id:String(p.id), title:p.title || '', thumbnailUrl:p.url_sq || p.url_m || null,
      previewUrl:p.url_z || p.url_m || null, takenAt:p.datetaken || null
    })));
    if (photos.length >= limit || photos.length >= total || !(set.photo || []).length) break;
    page++;
  } while (page <= 10);
  return {photosetId,canonical,total,photos:photos.slice(0,limit)};
}
async function fetchLineup(gameId) {
  const template = process.env.HMS_LINEUP_URL_TEMPLATE;
  const token = process.env.HMS_API_TOKEN;
  if (!template || !token) fail('Missing HMS_LINEUP_URL_TEMPLATE or HMS_API_TOKEN');
  if (!template.includes('{gameId}')) fail('HMS_LINEUP_URL_TEMPLATE must include {gameId}');
  const url = template.replaceAll('{gameId}',encodeURIComponent(gameId));
  if (new URL(url).protocol !== 'https:') fail('HMS API URL must be HTTPS');
  const header = process.env.HMS_AUTH_HEADER || 'Authorization';
  const prefix = process.env.HMS_AUTH_PREFIX ?? 'Bearer ';
  const response = await get(url, {[header]:prefix + token});
  return response.json();
}
const summary = [];
for (const [i, test] of cases.entries()) {
  const item = {case:i+1, gameId:test.gameId, org:test.org, flickrAlbum:test.flickrAlbum, hms:{ok:false}, flickr:{ok:false}};
  try {
    const lineup = await fetchLineup(test.gameId);
    // Store raw data locally for adapter inspection; do not publish.
    await writeFile(join(out,'case-'+(i+1)+'-lineup.json'),JSON.stringify(lineup,null,2));
    item.hms = {ok:true, saved:true};
  } catch (err) { item.hms = {ok:false,error:String(err.message)}; }
  try {
    const album = await fetchAlbum(test.flickrAlbum);
    await writeFile(join(out,'case-'+(i+1)+'-photos.json'),JSON.stringify(album,null,2));
    item.flickr = {ok:true, albumId:album.photosetId, total:album.total, sampled:album.photos.length};
  } catch (err) { item.flickr = {ok:false,error:String(err.message)}; }
  summary.push(item);
  console.log('Case '+(i+1)+': HMS '+(item.hms.ok?'OK':item.hms.error)+'; Flickr '+(item.flickr.ok?'OK '+item.flickr.sampled+'/'+item.flickr.total:item.flickr.error));
}
await writeFile(join(out,'summary.json'),JSON.stringify({generatedAt:new Date().toISOString(),summary},null,2));
console.log('Saved local report: photo-archive/out/summary.json');
