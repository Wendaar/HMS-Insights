const hosts = new Set(['flic.kr', 'flickr.com', 'www.flickr.com']);

// HMS multimedia sometimes contains only static image URLs. Resolve an album
// from Flickr's actual membership of those images, never from team/name search.
export async function albumForHmsImages(images,{env=process.env,fetchImpl=fetch}={}){
  if(!env.FLICKR_API_KEY || !Array.isArray(images))return null;
  const ids=[...new Set(images.map(image=>{try{const u=new URL(image.full || image.thumbnail);return u.protocol==='https:' && !u.port && !u.username && !u.password && /^(live\.staticflickr\.com|farm\d+\.staticflickr\.com)$/.test(u.hostname)?u.pathname.match(/\/([0-9]+)_[a-zA-Z0-9]+(?:_[a-z])?\.[a-z]+$/)?.[1]:null;}catch{return null;}}).filter(Boolean))].slice(0,2);
  if(!ids.length)return null;
  const api=async(method,photo_id)=>{const url=new URL('https://www.flickr.com/services/rest/');for(const [key,value] of Object.entries({method,photo_id,api_key:env.FLICKR_API_KEY,format:'json',nojsoncallback:1}))url.searchParams.set(key,String(value));const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Flickr membership unavailable');const data=await response.json();if(data.stat!=='ok')throw Error('Flickr membership rejected');return data;};
  const memberships=await Promise.all(ids.map(id=>api('flickr.photos.getAllContexts',id)));
  const sets=memberships.map(data=>new Set((data.set || []).map(s=>String(s.id)).filter(id=>/^\d+$/.test(id))));
  const common=[...sets[0]].filter(id=>sets.every(set=>set.has(id)));if(common.length!==1)return null;
  const info=await api('flickr.photos.getInfo',ids[0]);if(String(info.photo?.id)!==ids[0] || !/^[a-zA-Z0-9@_-]+$/.test(info.photo?.owner?.nsid || ''))return null;
  return `https://www.flickr.com/photos/${info.photo.owner.nsid}/albums/${common[0]}`;
}

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

export async function fetchAlbum(value, {limit = 25, offset=0, env = process.env, fetchImpl = fetch, resolved} = {}) {
  if (!env.FLICKR_API_KEY?.trim()) throw new Error('Missing FLICKR_API_KEY');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid photo limit');
  if(!Number.isInteger(offset)||offset<0||offset>100000||offset%limit)throw new Error('Invalid photo offset');
  const album = resolved || await resolveAlbum(value, {fetchImpl});
  const photos = [];
  let total = 0;
  for (let page = offset/limit+1; page <= offset/limit+10; page++) {
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
    if (photos.length >= limit || offset+photos.length >= total || !set.photo.length) break;
  }
  return {...album,total,photos:photos.slice(0,limit),nextOffset:Math.min(total,offset+Math.min(limit,photos.length))};
}
