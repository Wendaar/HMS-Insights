import {readFile} from 'node:fs/promises';
import {toolStore} from '../infrastructure/tool-instances.js';
import {organizationConfig} from './organizations.js';
import {fetchGameDetail,fetchGameLineup,hmsConfigFromEnv} from '../hms/client.js';
import {normalizeLineup} from '../../photo-archive/lineup.mjs';
import {fetchAlbum} from '../../photo-archive/flickr.mjs';
import {suggestPlayers} from '../../photo-archive/matcher.mjs';
import {pilotObservations} from '../../photo-archive/pilot-observations.mjs';
import {analysisStats,createArchiveAnalysis} from './photo-archive-analysis.js';
import {withMatchJerseys} from '../../photo-archive/jersey-context.mjs';

export const PHOTO_ARCHIVE_TOOL='photo-archive-preview';
export const photoArchiveEnabled=env=>env.VERCEL_ENV==='preview' && env.VERCEL_GIT_COMMIT_REF==='codex/hms-photo-archive-pilot' || env.PHOTO_ARCHIVE_LOCAL==='1' && env.VERCEL_ENV!=='production';
export class PhotoArchiveError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new PhotoArchiveError(status,message);};
const same=(a,b)=>typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
export function flickrImage(value){
  if(typeof value!=='string')return null;
  try {const u=new URL(value);return u.protocol==='https:' && !u.port && !u.username && !u.password && /^(live\.staticflickr\.com|farm\d+\.staticflickr\.com)$/.test(u.hostname)?u.href:null;} catch{return null;}
}
export function archiveStats(state){
  const photos=state?.photos || [],reviews=state?.reviews || {};
  return {total:photos.length,confirmed:photos.filter(p=>reviews[p.id]?.status==='confirmed').length,
    rejected:photos.filter(p=>reviews[p.id]?.status==='rejected').length,inProgress:photos.filter(p=>reviews[p.id]?.status==='in_progress').length,pending:photos.filter(p=>!reviews[p.id] || reviews[p.id].status==='pending').length};
}
export async function readArchiveCases(){return JSON.parse(await readFile(new URL('../../photo-archive/pilot-cases.json',import.meta.url),'utf8'));}

export function createPhotoArchive(options={}){
  const env=options.env ?? process.env,store=options.store ?? toolStore({env,tool:PHOTO_ARCHIVE_TOOL}),fetchImpl=options.fetchImpl ?? fetch;
  const now=()=>new Date(options.now?.() ?? Date.now()).toISOString();
  const ready=!!(options.store || env.DATABASE_URL);
  async function context(org,gameId){
    if(org!=='PHM')fail(404,'Pilot fotoarchivu je nyní dostupný pro PHM.');
    const cases=await(options.readCases ?? readArchiveCases)();
    const item=cases.find(c=>c.org===org && same(c.gameId,gameId));
    if(!item)fail(404,'Zápas není v pilotním výběru.');
    return item;
  }
  const get=async(org,gameId)=>{await context(org,gameId);return store.get(org,gameId.toLowerCase());};
  function requireStorage(){if(!ready)fail(503,'Databáze fotoarchivu není připojená. Změny se neuložily.');}
  function view(row,item){
    const state=row?.draft;
    return {gameId:item.gameId,org:item.org,revision:row?.revision ?? 0,needsImport:!state,stats:archiveStats(state),analysisStats:analysisStats(state),
      state:state?{...state,audit:(state.audit || []).slice(-20),photos:state.photos.map(photo=>({...photo,
        analysis:state.analyses?.[photo.id] || (pilotObservations[photo.id]?{status:'complete',model:'gpt-6-luna',source:'pilot'}:null),
        observations:state.analyses?.[photo.id]?.observations || pilotObservations[photo.id] || [],suggestions:suggestPlayers(state.players,state.analyses?.[photo.id]?.observations || pilotObservations[photo.id] || [],state.teams)}))}:null};
  }
  async function loadSource(org,item){
    if(options.loadSource)return options.loadSource(org,item);
    const scoped=organizationConfig(org,env);
    const config={...hmsConfigFromEnv({...env,HMS_API_TOKEN:scoped.token}),timeoutMs:15000,retries:0};
    const init={config,fetchImpl:(url,settings)=>fetchImpl(url,{...settings,redirect:'error'})};
    const [detail,lineup,album]=await Promise.all([fetchGameDetail(item.gameId,init),fetchGameLineup(item.gameId,init),
      fetchAlbum(item.flickrAlbum,{limit:250,env:{FLICKR_API_KEY:env.FLICKR_API_KEY || env.FLICKT_API_KEY},fetchImpl})]);
    if(!same(detail?.organizationId,scoped.id))fail(422,'HMS nepotvrdilo organizaci vybraného zápasu.');
    const normalized=normalizeLineup(item.gameId,detail,lineup);
    const teams=withMatchJerseys([{teamId:normalized.homeTeamId,name:detail.HomeTeam?.name || 'Domácí'},{teamId:normalized.awayTeamId,name:detail.AwayTeam?.name || 'Hosté'}],detail);
    return {gameId:item.gameId,title:teams.map(t=>t.name).join(' × '),playedOn:detail.startDate || null,teams,players:normalized.players,
      albumId:album.photosetId,albumUrl:album.canonical,albumTotal:album.total,photos:album.photos};
  }
  return {
    ready,
    ...createArchiveAnalysis({env,store,context,view,requireStorage,fail,now,fetchImpl,analyzer:options.analyzer}),
    async catalog(org){
      if(org!=='PHM')fail(404,'Pilot fotoarchivu je nyní dostupný pro PHM.');
      const cases=await(options.readCases ?? readArchiveCases)();
      return Promise.all(cases.filter(c=>c.org===org).map(async(c,i)=>{const row=await store.get(org,c.gameId.toLowerCase());return {gameId:c.gameId,
        title:row?.draft?.title || `Pilotní zápas ${i+1}`,playedOn:row?.draft?.playedOn || null,albumUrl:c.flickrAlbum,imported:!!row,revision:row?.revision ?? 0,stats:archiveStats(row?.draft)};}));
    },
    async read(org,gameId){const item=await context(org,gameId);return view(await store.get(org,gameId.toLowerCase()),item);},
    async importCase(org,gameId,revision,reviewer='Operations'){
      requireStorage();const item=await context(org,gameId),current=await get(org,gameId);
      if(!Number.isInteger(revision) || revision!==(current?.revision ?? 0))fail(409,'Zápas mezitím změnil jiný uživatel. Obnovte data.');
      const source=await loadSource(org,item);
      if(!same(source.gameId,gameId) || !Array.isArray(source.players) || !source.players.length || !Array.isArray(source.photos) || source.photos.length>250)fail(422,'Neplatná data zdrojového alba nebo soupisky.');
      const photos=source.photos.map(photo=>{
        if(!/^\d+$/.test(photo.id))fail(422,'Flickr vrátilo neplatnou identitu fotografie.');
        return {id:photo.id,title:String(photo.title || '').slice(0,200),thumbnailUrl:flickrImage(photo.thumbnailUrl),previewUrl:flickrImage(photo.previewUrl),
          originalUrl:`https://www.flickr.com/photos/153512269@N03/${photo.id}/`,takenAt:photo.takenAt || null};
      });
      const merged=new Map((current?.draft?.photos || []).map(p=>[p.id,p]));for(const p of photos)merged.set(p.id,p);
      const state={schemaVersion:1,org,gameId:item.gameId,title:source.title,playedOn:source.playedOn,teams:source.teams,players:source.players,
        albumId:String(source.albumId),albumUrl:item.flickrAlbum,albumTotal:source.albumTotal,photos:[...merged.values()],reviews:current?.draft?.reviews || {},
        analyses:current?.draft?.analyses || {},analysisJob:current?.draft?.analysisJob || null,
        importedAt:now(),audit:[...(current?.draft?.audit || []),{action:'import',at:now(),actor:reviewer}].slice(-1000)};
      const saved=await store.save(org,gameId.toLowerCase(),state,revision,null);
      if(!saved)fail(409,'Data se změnila během importu. Obnovte je.');return view(saved,item);
    },
    async decide(org,body,actor){
      requireStorage();const item=await context(org,body?.gameId),current=await get(org,item.gameId),state=current?.draft;
      if(!state)fail(409,'Nejdříve načtěte a uložte album.');
      if(!Number.isInteger(body.revision) || body.revision!==current.revision)fail(409,'Jiný uživatel mezitím změnil přiřazení. Obnovte data.');
      if(!state.photos.some(p=>p.id===body.photoId))fail(404,'Fotografie nepatří do tohoto zápasu.');
      if(!['assign','draft','reject','reset'].includes(body.decision))fail(400,'Neplatné rozhodnutí.');
      const reviewer=String(body.reviewer || '').trim();if(!reviewer || reviewer.length>80)fail(400,'Doplňte jméno kontrolora do 80 znaků.');
      const note=String(body.note || '').trim();if(note.length>300)fail(400,'Poznámka může mít nejvýše 300 znaků.');
      let players=[];
      if(['assign','draft'].includes(body.decision)){
        if(!Array.isArray(body.playerIds) || body.decision==='assign' && !body.playerIds.length || body.playerIds.length>60 || new Set(body.playerIds.map(id=>String(id).toLowerCase())).size!==body.playerIds.length)fail(400,'Vyberte alespoň jednoho hráče bez duplicit.');
        players=body.playerIds.map(id=>{const matches=state.players.filter(p=>same(p.playerId,id));if(matches.length!==1)fail(400,'Hráč není jednoznačně v soupisce tohoto zápasu.');return {...matches[0]};});
      }
      const at=now(),status={assign:'confirmed',draft:'in_progress',reject:'rejected',reset:'pending'}[body.decision];
      const review={status,players,reviewerLabel:reviewer,reviewedBy:actor,reviewedAt:at,note};
      const next={...state,reviews:{...state.reviews,[body.photoId]:review},audit:[...(state.audit || []),{action:body.decision,photoId:body.photoId,
        playerIds:players.map(p=>p.playerId),previousPlayerIds:(state.reviews[body.photoId]?.players || []).map(p=>p.playerId),actor,reviewerLabel:reviewer,at}].slice(-1000)};
      const saved=await store.save(org,item.gameId.toLowerCase(),next,body.revision,null);
      if(!saved)fail(409,'Změnu současně uložil jiný uživatel. Obnovte data.');return view(saved,item);
    },
    async archive(org,playerId=null){
      const cases=await(options.readCases ?? readArchiveCases)();if(org!=='PHM')fail(404,'Neznámý fotoarchiv.');
      const rows=await Promise.all(cases.filter(c=>c.org===org).map(c=>store.get(org,c.gameId.toLowerCase())));
      const players=new Map();
      for(const row of rows){const state=row?.draft;if(!state)continue;
        for(const photo of state.photos){const review=state.reviews[photo.id];if(review?.status!=='confirmed')continue;
          for(const player of review.players){if(playerId && !same(playerId,player.playerId))continue;
            const key=player.playerId.toLowerCase();if(!players.has(key))players.set(key,{playerId:player.playerId,name:player.name || 'Hráč',photos:[]});
            const archive=players.get(key);if(archive.photos.some(p=>p.id===photo.id))continue;
            archive.photos.push({...photo,gameId:state.gameId,gameTitle:state.title,playedOn:state.playedOn,teamId:player.teamId,
              teamName:state.teams.find(t=>same(t.teamId,player.teamId))?.name || 'Tým',jerseyNumber:player.jerseyNumber,
              reviewedAt:review.reviewedAt,reviewerLabel:review.reviewerLabel});
          }
        }
      }
      return [...players.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs'));
    }
  };
}
