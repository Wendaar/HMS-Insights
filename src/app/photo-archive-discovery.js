import {organizationConfig} from './organizations.js';
import {fetchGames,fetchGameDetail,fetchTeams,hmsConfigFromEnv} from '../hms/client.js';
import {gameRows} from './backfill-finished-games.js';
import {isGameId} from '../domain/game-summary.js';
import {flickrAlbum} from '../../public/game-report-media.js';
import {albumForHmsImages} from '../../photo-archive/flickr.mjs';
const same=(a,b)=>typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
export const archiveGameTitle=g=>[g.HomeTeam?.name || g.homeTeamName,g.AwayTeam?.name || g.awayTeamName].every(Boolean)?[g.HomeTeam?.name || g.homeTeamName,g.AwayTeam?.name || g.awayTeamName].join(' × '):g.name || 'Týmy zatím neurčeny';
export function createArchiveDiscovery({env,store,fetchImpl=fetch}){
  function connection(org){const c=organizationConfig(org,env);return {scoped:c,options:{config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:c.token}),timeoutMs:12000,retries:0},fetchImpl:(url,init)=>fetchImpl(url,{...init,redirect:'error'})}};}
  const valid=(g,c)=>{if(!isGameId(g?.gameId)||g.organizationId?.toLowerCase()!==c.id.toLowerCase())throw Error('Archive organization identity mismatch');return g;};
  async function multimedia(detail){
    const direct=flickrAlbum(detail.flickrAlbum)||flickrAlbum(detail.albumUrl);
    const albumFieldStatus=Object.hasOwn(detail,'flickrAlbum')?(flickrAlbum(detail.flickrAlbum)?'link':'empty'):'unavailable';
    detail={...detail,albumFieldStatus};
    if(direct && detail.HomeTeam?.name && detail.AwayTeam?.name)return {detail,album:direct};
    try{const read=async endpoint=>{const r=await fetchImpl('https://api.prod.hms.wootera.net/public/'+endpoint+'?gameId='+encodeURIComponent(detail.gameId),{redirect:'error',headers:{accept:'application/json'},signal:AbortSignal.timeout(3500)});return r.ok?r.json():null;};
      const [game,media]=await Promise.all([read('game'),read('gameMultimedia')]);
      if(!game || !same(game.HomeTeam?.teamId,detail.homeTeamId || detail.HomeTeam?.teamId)||!same(game.AwayTeam?.teamId,detail.awayTeamId || detail.AwayTeam?.teamId)||game.startDate!==detail.startDate||game.gameId && !same(game.gameId,detail.gameId)||media?.gameId && !same(media.gameId,detail.gameId))return {detail,album:direct};
      const enriched={...detail,HomeTeam:{...game.HomeTeam,...detail.HomeTeam},AwayTeam:{...game.AwayTeam,...detail.AwayTeam}};
      const album=direct || (albumFieldStatus==='empty'?null:flickrAlbum(media?.albumUrl)||flickrAlbum(media?.flickrAlbum)||flickrAlbum(game.flickrAlbum)||await albumForHmsImages(media?.images,{env:{FLICKR_API_KEY:env.FLICKR_API_KEY || env.FLICKT_API_KEY},fetchImpl}));
      return {detail:enriched,album};
    }catch{return {detail,album:direct};}
  }
  return {
    async context(org,gameId,fallback=null){
      if(!isGameId(gameId))throw Error('Invalid game ID');
      const {scoped,options}=connection(org),detail=valid(await fetchGameDetail(gameId,options),scoped);
      if(detail.gameId.toLowerCase()!==gameId.toLowerCase())throw Error('Wrong game');
      const resolved=await multimedia(detail),album=resolved.album || flickrAlbum(fallback);if(!album)throw Error('HMS game has no supported album; attach an album URL');
      return {org,gameId:detail.gameId,flickrAlbum:album,albumSource:resolved.album?'hms':'saved-link',detail:resolved.detail};
    },
    async discover(org,{from,to,offset=0}={}){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());to ||= today;from ||= new Date(Date.parse(today)-14*86400000).toISOString().slice(0,10);
      if(![from,to].every(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s)))||from>to||Date.parse(to)-Date.parse(from)>366*86400000||!Number.isInteger(offset)||offset<0||offset>100000)throw new TypeError('Invalid date range/page');
      const {scoped,options}=connection(org),rows=gameRows(await fetchGames({from,to,status:'ALL',limit:20,skip:offset},options));
      if(rows.length>20)throw Error('HMS pagination failed');
      let teams=[];try{const payload=await fetchTeams(options);teams=Array.isArray(payload)?payload:payload?.teams || payload?.items || payload?.data || [];if(!Array.isArray(teams)||teams.length>10000)teams=[];}catch{/* public game labels remain available */}
      if(teams.some(t=>t.organizationId&&!same(t.organizationId,scoped.id)))throw Error('Archive team organization identity mismatch');
      const teamMap=new Map(teams.map(t=>[t.teamId?.toLowerCase(),t]));
      let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<rows.length){const i=cursor++,g=valid(rows[i],scoped);
        let detail;try{detail=await fetchGameDetail(g.gameId,{...options,config:{...options.config,timeoutMs:3500}});}catch{/* A failed optional detail must not hide the authoritative game list. */}
        if(detail){valid(detail,scoped);if(!same(detail.gameId,g.gameId))throw Error('Wrong game');}
        const resolved=await multimedia({...g,...detail});rows[i]={...g,...resolved.detail,flickrAlbum:resolved.album};
        for(const [side,id] of [['HomeTeam','homeTeamId'],['AwayTeam','awayTeamId']]){const t=teamMap.get((rows[i][id] || rows[i][side]?.teamId)?.toLowerCase());if(t)rows[i][side]={...t,...rows[i][side],name:rows[i][side]?.name || t.name};}
      }}));
      const existing=await store.get(org,'catalog'),items=new Map((existing?.draft?.items || []).map(i=>[i.gameId.toLowerCase(),i]));
      for(const raw of rows){const g=valid(raw,scoped);if(g.startDate<from||g.startDate>to)throw Error('HMS date boundary mismatch');
        const album=flickrAlbum(g.flickrAlbum),old=items.get(g.gameId.toLowerCase());
        // Lists may omit album fields: preserve known entries; detail import validates the current URL.
        items.set(g.gameId.toLowerCase(),{org,gameId:g.gameId,title:archiveGameTitle(g),playedOn:g.startDate,albumFieldStatus:g.albumFieldStatus,flickrAlbum:album || (g.albumFieldStatus==='empty' && old?.source!=='saved-link'?null:old?.flickrAlbum) || null,source:album?'hms':old?.source || 'hms',checkedAt:new Date().toISOString()});
      }
      const saved=await store.save(org,'catalog',{title:'Archive discovery',items:[...items.values()],syncedAt:new Date().toISOString()},existing?.revision || 0,null);
      if(!saved)throw Error('Archive discovery changed concurrently; refresh');
      return {from,to,offset,nextOffset:offset+rows.length,hasMore:rows.length===20,games:rows.length,albums:rows.filter(g=>flickrAlbum(g.flickrAlbum)).length,gameIds:rows.map(g=>g.gameId)};
    }
  };
}
