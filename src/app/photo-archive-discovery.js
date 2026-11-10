import {organizationConfig} from './organizations.js';
import {fetchGames,fetchGameDetail,hmsConfigFromEnv} from '../hms/client.js';
import {gameRows} from './backfill-finished-games.js';
import {isGameId} from '../domain/game-summary.js';
import {flickrAlbum} from '../../public/game-report-media.js';
export function createArchiveDiscovery({env,store,fetchImpl=fetch}){
  function connection(org){const c=organizationConfig(org,env);return {scoped:c,options:{config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:c.token}),timeoutMs:12000,retries:0},fetchImpl:(url,init)=>fetchImpl(url,{...init,redirect:'error'})}};}
  const valid=(g,c)=>{if(!isGameId(g?.gameId)||g.organizationId?.toLowerCase()!==c.id.toLowerCase())throw Error('Archive organization identity mismatch');return g;};
  return {
    async context(org,gameId){
      if(!isGameId(gameId))throw Error('Invalid game ID');
      const {scoped,options}=connection(org),detail=valid(await fetchGameDetail(gameId,options),scoped);
      if(detail.gameId.toLowerCase()!==gameId.toLowerCase())throw Error('Wrong game');
      const album=flickrAlbum(detail.flickrAlbum);if(!album)throw Error('HMS game has no supported album');
      return {org,gameId:detail.gameId,flickrAlbum:album,detail};
    },
    async discover(org,{from,to,offset=0}={}){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());to ||= today;from ||= new Date(Date.parse(today)-14*86400000).toISOString().slice(0,10);
      if(![from,to].every(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s)))||from>to||Date.parse(to)-Date.parse(from)>366*86400000||!Number.isInteger(offset)||offset<0||offset>100000)throw new TypeError('Invalid date range/page');
      const {scoped,options}=connection(org),rows=gameRows(await fetchGames({from,to,status:'ALL',limit:20,skip:offset},options));
      if(rows.length>20)throw Error('HMS pagination failed');
      let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<rows.length){const i=cursor++,g=valid(rows[i],scoped);if(g.flickrAlbum===undefined){const detail=valid(await fetchGameDetail(g.gameId,{...options,config:{...options.config,timeoutMs:3500}}),scoped);if(detail.gameId.toLowerCase()!==g.gameId.toLowerCase())throw Error('Wrong game');rows[i]={...g,flickrAlbum:detail.flickrAlbum || null};}}}));
      const existing=await store.get(org,'catalog'),items=new Map((existing?.draft?.items || []).map(i=>[i.gameId.toLowerCase(),i]));
      for(const raw of rows){const g=valid(raw,scoped);if(g.startDate<from||g.startDate>to)throw Error('HMS date boundary mismatch');
        const album=flickrAlbum(g.flickrAlbum),old=items.get(g.gameId.toLowerCase());
        // Lists may omit album fields: preserve known entries; detail import validates the current URL.
        items.set(g.gameId.toLowerCase(),{org,gameId:g.gameId,title:[g.HomeTeam?.name || 'Domácí',g.AwayTeam?.name || 'Hosté'].join(' × '),playedOn:g.startDate,flickrAlbum:album || old?.flickrAlbum || null,source:'hms',checkedAt:new Date().toISOString()});
      }
      const saved=await store.save(org,'catalog',{title:'Archive discovery',items:[...items.values()],syncedAt:new Date().toISOString()},existing?.revision || 0,null);
      if(!saved)throw Error('Archive discovery changed concurrently; refresh');
      return {from,to,offset,nextOffset:offset+rows.length,hasMore:rows.length===20,games:rows.length,albums:rows.filter(g=>flickrAlbum(g.flickrAlbum)).length};
    }
  };
}
