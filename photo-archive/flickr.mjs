const hosts = new Set(['flic.kr', 'flickr.com', 'www.flickr.com']);

function flickrUrl(value, base) {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.port || url.username || url.password) {
    throw new Error('Expected an HTTPS Flickr URL');
  }
  return url;
}

export function albumFromUrl(value) {
  const url = flickrUrl(value);
  const match = url.pathname.match(/^\/photos\/([^/]+)\/(?:albums|sets)\/(\d+)\/?$/);
  return match ? {photosetId: match[2], canonical: `https://www.flickr.com/photos/${match[1]}/albums/${match[2]}`} : null;
}

// Shared album links can stop at a /gp/ guest URL or an HTML landing page.
// Only canonical/og:url metadata is accepted; unrelated albums in page content are ignored.
export async function resolveAlbum(value, {fetchImpl = fetch} = {}) {
  let url = flickrUrl(value);
  const direct = albumFromUrl(url);
  if (direct) return {...direct, resolution: 'url'};
  if (!/^\/(?:s\/[^/]+|gp\/[^/]+\/[^/]+)\/?$/.test(url.pathname)) throw new Error('Unsupported Flickr album link');
  for (let hop = 0; hop < 6; hop++) {
    const r = await fetchImpl(url, {redirect: 'manual', signal: AbortSignal.timeout(20000)});
    if ([301,302,303,307,308].includes(r.status)) {
      const location = r.headers.get('location');
      if (!location) throw new Error('Flickr redirect has no Location');
      url = flickrUrl(location, url);
      const album = albumFromUrl(url);
      if (album) return {...album, resolution: 'redirect'};
      continue;
    }
    if (!r.ok) throw new Error(`Flickr landing HTTP ${r.status}`);
    const html = await r.text();
    const albums = new Map();
    for (const tag of html.match(/<(?:link|meta)\b[^>]*>/gi) || []) {
      const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
      const candidate = attrs.rel?.toLowerCase() === 'canonical' ? attrs.href : attrs.property?.toLowerCase() === 'og:url' ? attrs.content : null;
      if (!candidate) continue;
      try {
        const album = albumFromUrl(flickrUrl(candidate.replaceAll('&amp;', '&'), url));
        if (album) albums.set(album.photosetId, album);
      } catch { /* Untrusted metadata is not an album. */ }
    }
    if (albums.size === 1) return {...albums.values().next().value, resolution: 'metadata'};
    throw new Error(albums.size > 1 ? 'Conflicting Flickr album metadata' : 'Flickr landing has no numeric canonical album ID');
  }
  throw new Error('Too many Flickr redirects');
}

export async function fetchAlbum(value, {limit = 25, env = process.env, fetchImpl = fetch, resolved} = {}) {
  if (!env.FLICKR_API_KEY?.trim()) throw new Error('Missing FLICKR_API_KEY');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid photo limit');
  const album = resolved || await resolveAlbum(value, {fetchImpl});
  const photos = [];
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const url = new URL('https://www.flickr.com/services/rest/');
    for (const [k,v] of Object.entries({method:'flickr.photosets.getPhotos',api_key:env.FLICKR_API_KEY,format:'json',nojsoncallback:1,
      photoset_id:album.photosetId,page,per_page:limit,extras:'url_sq,url_m,url_z,url_b,date_taken'})) url.searchParams.set(k,String(v));
    const r = await fetchImpl(url, {redirect:'error', signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw new Error(`Flickr API HTTP ${r.status}`);
    const data = await r.json();
    if (data.stat !== 'ok') throw new Error(`Flickr API rejected request (code ${Number(data.code) || 'unknown'})`);
    const set = data.photoset;
    if (!set || String(set.id) !== album.photosetId || !Array.isArray(set.photo) || !Number.isInteger(Number(set.total)) || Number(set.total) < 0) throw new Error('Invalid Flickr photoset response');
    total = Number(set.total);
    photos.push(...set.photo.map(p => ({id:String(p.id),title:p.title || '',thumbnailUrl:p.url_sq || p.url_m || null,
      previewUrl:p.url_b || p.url_z || p.url_m || null,takenAt:p.datetaken || null})));
    if (photos.length >= limit || photos.length >= total || !set.photo.length) break;
  }
  return {...album,total,photos:photos.slice(0,limit)};
}
