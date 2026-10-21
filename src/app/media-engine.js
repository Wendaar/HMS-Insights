import {hmsMediaContext} from '../hms/media-context.js';
// Trigger-neutral read model. No writes to HMS, imported snapshots or Příklepy.
import { fetchGames, fetchGameDetail, fetchOrganization, fetchPublicGameMetadata, fetchGameResponses, hmsConfigFromEnv } from '../hms/client.js';
import { normalizeHmsGame } from '../hms/normalize.js';
import { buildGameSummary, isGameId } from '../domain/game-summary.js';
import { rowsFor } from '../infrastructure/analysis-rows.js';
import { loadGameSnapshot, loadStudioPage, loadStudioGameLabels, loadStudioInsights } from '../infrastructure/postgres-repository.js';
import { gameRows } from './backfill-finished-games.js';
import { sportingImage } from '../../public/game-report-media.js';

export const organizations = ['PHM','EUCHL','YHG','BNHLH'];
const cache = new Map();
const pending = new Map();
const organizationImages=new Map();
async function organizationImage(config,env,options){
  if(!config.token)return null;
  const cached=organizationImages.get(config.id);if(cached?.expires>Date.now())return cached.url;
  try{const info=await (options.fetchOrganization??fetchOrganization)({config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token}),timeoutMs:3000,retries:0}});
    const url=same(info.organizationId,config.id)?teamImage(info):null;
    organizationImages.set(config.id,{url,expires:Date.now()+60000});return url;
  }catch{return null;}
}
export function organizationConfig(org, env = process.env) {
  if (!organizations.includes(org)) throw new TypeError('Neplatná organizace.');
  // PHM identity comes from the existing repository's real-game fixtures.
  const id = env[`HMS_${org}_ORGANIZATION_ID`] || (org === 'PHM' ? 'BB669217-41EB-4162-8040-A73F49A43570' : null);
  if (!isGameId(id)) throw new Error('Organizace zatím nemá nastavené datové připojení.');
  return { id, token: env[`HMS_${org}_API_TOKEN`] || env.HMS_API_TOKEN };
}
export function timeWindow(filter = 'Today', now = new Date(), page = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const shift = n => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
  // from/to are HMS calendar dates; inclusive endpoints, never UTC-midnight arithmetic.
  const ranges = {Today:[0,0],Yesterday:[-1,-1],Tomorrow:[1,1],'-7 days':[-7,-1],'+7 days':[1,7],Past:[-30*(page+1),-1-30*page],Future:[1+30*page,30*(page+1)]};
  if (!ranges[filter]) throw new TypeError('Neplatný filtr.');
  return {from:shift(ranges[filter][0]),to:shift(ranges[filter][1])};
}
function same(a,b) { return typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase(); }
function assertOrg(id, expected) { if (!same(id,expected)) throw new Error('Zdroj neodpovídá vybrané organizaci.'); }
function teamImage(team) {return sportingImage(team?.logoUrls?.md??team?.logoUrl);}
const labelCache=new Map();
async function pageLabels(rows,config,options,hmsConfig) {
  hmsConfig={...hmsConfig,signal:AbortSignal.timeout(12000)};
  let stored=[];
  if((options.env??process.env).DATABASE_URL)try {stored=await (options.loadLabels??loadStudioGameLabels)(rows.map(g=>g.gameId),config.id,{env:options.env});}catch {/* Detail fallback remains read-only. */}
  const byId=new Map(stored.map(g=>[g.game_id.toLowerCase(),g]));
  const result=new Array(rows.length);let cursor=0;
  // At most three detail reads at once and never more than this 20-game page.
  await Promise.all(Array.from({length:Math.min(3,rows.length)},async()=>{
    while(cursor<rows.length){const index=cursor++,g=rows[index],record=byId.get(g.gameId.toLowerCase());
      let home={name:g.HomeTeam?.name,logoUrl:teamImage(g.HomeTeam)},away={name:g.AwayTeam?.name,logoUrl:teamImage(g.AwayTeam)};
      if(record){home.name ||=record.home_team_name;away.name ||=record.away_team_name;
        home.logoUrl ||=sportingImage(record.home_logo_template_url)??sportingImage(record.home_logo_url);
        away.logoUrl ||=sportingImage(record.away_logo_template_url)??sportingImage(record.away_logo_url);}
      const key=`${config.id}:${g.gameId.toLowerCase()}`,cached=labelCache.get(key);
      if(cached?.expires>Date.now()){home.name ||=cached.home.name;away.name ||=cached.away.name;home.logoUrl ||=cached.home.logoUrl;away.logoUrl ||=cached.away.logoUrl;}
      if((!home.name||!away.name)&&!hmsConfig.signal.aborted)try {
        const detail=await (options.fetchDetail??fetchGameDetail)(g.gameId,{config:hmsConfig});
        assertOrg(detail.organizationId,config.id);if(!same(detail.gameId,g.gameId))throw new Error('Jiný zápas');
        home={name:detail.HomeTeam?.name??home.name,logoUrl:teamImage(detail.HomeTeam)??home.logoUrl};
        away={name:detail.AwayTeam?.name??away.name,logoUrl:teamImage(detail.AwayTeam)??away.logoUrl};
      }catch {/* A missing label is explicit, never a fictional home/away team. */}
      if(home.name&&away.name){labelCache.set(key,{home,away,expires:Date.now()+60000});if(labelCache.size>200)labelCache.delete(labelCache.keys().next().value);}
      result[index]={gameId:g.gameId,playedOn:g.startDate,status:g.status,startTime:g.startTime??null,home,away,labelsAvailable:!!(home.name&&away.name)};
    }
  }));return result;
}
export function applyPublicMedia(summary,metadata) {
  // Optional media must be for this exact sporting fixture. Never overwrite
  // result, names, statistics or Příklepy with a public endpoint response.
  if(!metadata||!same(metadata.HomeTeam?.teamId,summary.home.id)||!same(metadata.AwayTeam?.teamId,summary.away.id)||metadata.startDate!==summary.playedOn)return summary;
  summary.home.logoUrl ||=teamImage(metadata.HomeTeam);summary.away.logoUrl ||=teamImage(metadata.AwayTeam);
  const group=metadata.Phase?.Group;
  const branding=hmsMediaContext(metadata);
  if(group?.name===summary.group)summary.groupLogoUrl ||=branding.groupLogoUrl;
  if(branding.competitionName===summary.competition)summary.competitionLogoUrl ||=branding.competitionLogoUrl;
  for(const row of metadata.Lineups??[]){const person=row.Player;const player=[...summary.players??[],...summary.goalies??[]].find(p=>same(p.id,person?.playerId)&&same(p.teamId,row.teamId));
    if(player&&!player.imageUrl)player.imageUrl=teamImage(person);
  }
  if(metadata.Phase?.name===summary.phase)summary.phaseLogoUrl ||=teamImage(metadata.Phase);
  return summary;
}
export async function browseMedia({org,filter='Today',offset=0,windowPage=0,section='games',query='',type=''}, options={}) {
  const env=options.env??process.env, config=organizationConfig(org,env);
  const limit=20;
  if(section==='insights'){
    const types=['HATTRICK','MULTIPOINT_GAME','BIG_SAVES','EARLY_GOAL','BIG_WIN'];
    if(type&&!types.includes(type))throw new TypeError('Neplatný typ Insightu.');
    const today=timeWindow('Today',options.now).from;
    const page=await (options.loadInsights??loadStudioInsights)({organizationId:config.id,today,query:String(query).slice(0,160),type,offset,limit,env});
    page.items=page.items.map(item=>({id:item.id,gameId:item.gameId,type:item.type,title:item.title,text:item.text,date:item.date,
      player:item.player,playerId:item.playerId??null,team:item.team,teamId:item.teamId??null,
      homeTeam:item.homeTeam,awayTeam:item.awayTeam,homeScore:item.homeScore,awayScore:item.awayScore,competition:item.competition,group:item.group,
      playerImageUrl:sportingImage(item.playerImageUrl),teamLogoUrl:sportingImage(item.teamLogoUrl),
      stats:Object.fromEntries(['goals','assists','points','saves','goalsAgainst'].filter(k=>Number.isFinite(item.facts?.[k])).map(k=>[k,item.facts[k]]))}));
    return page;
  }
  const range=timeWindow(filter,options.now,windowPage);
  if(!config.token)return (options.loadPage??loadStudioPage)({organizationId:config.id,...range,offset,limit,section,env});
  const hmsConfig={...hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token}),token:config.token,timeoutMs:5000,retries:0};
  const rows=gameRows(await (options.fetchGames??fetchGames)({...range,limit,skip:offset}, {config:hmsConfig}));
  if(rows.length>limit) throw new Error('HMS nerespektuje stránkování.');
  for(const g of rows) {
    assertOrg(g.organizationId,config.id);
    if(!isGameId(g.gameId) || !/^\d{4}-\d{2}-\d{2}$/.test(g.startDate??'') || g.startDate<range.from || g.startDate>range.to) throw new Error('HMS nerespektuje časový rozsah.');
  }
  return {items:await pageLabels(rows,config,options,hmsConfig),hasMore:rows.length===limit,offset,source:'HMS',...range};
}
export async function mediaGame(org,gameId,options={}) {
  if(!isGameId(gameId)) throw new TypeError('Neplatné gameId.');
  const env=options.env??process.env, config=organizationConfig(org,env);
  const key=`${org}:${gameId.toLowerCase()}`, now=Date.now();
  if(cache.get(key)?.expires>now && (!options.refresh || cache.get(key).refreshedAt>now-10000)) return cache.get(key).value;
  if(pending.has(key)) return pending.get(key);
  if(pending.size>=8)throw new Error('Datový zdroj je vytížený.');
  const task=(async()=>{
    let snapshot;
    if(!options.refresh && env.DATABASE_URL) {
      snapshot=await (options.loadSnapshot??loadGameSnapshot)(gameId,{env});
      if(snapshot) assertOrg(snapshot.game.organization_id,config.id);
    }
    let summary;
    let publicMetadata;
    if(snapshot) summary=buildGameSummary(snapshot);
    else {
      const hmsConfig={...hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token}),timeoutMs:6000,retries:0};
      const [detail,events,lineup,metadata]=await (options.fetchResponses??fetchGameResponses)(gameId,{config:hmsConfig});
      publicMetadata=metadata;
      assertOrg(detail?.organizationId,config.id);
      if(!same(detail?.gameId,gameId)) throw new Error('Zdroj vrátil jiný zápas.');
      const game=normalizeHmsGame(events,lineup,detail,metadata,{allowUnfinished:true});
      assertOrg(game.organizationId,config.id);
      const rows=rowsFor({game,priklepy:[]});
      // Missing official counters AND unavailable goal history are unknown, not 0:0.
      if(game.eventSnapshot?.collections?.goals!==true) {
        if(detail.HomeTeamGoals==null)rows.games[0].home_score=null;
        if(detail.AwayTeamGoals==null)rows.games[0].away_score=null;
      }
      summary=buildGameSummary({game:rows.games[0],teams:rows.team_game_stats,players:rows.player_game_stats,goalies:rows.goalie_game_stats});
      summary.provenance={...summary.provenance,score:'hms-result-or-recorded-goals'};
      summary.currentPeriod=Number.isInteger(detail.currentPeriod)&&detail.currentPeriod>0&&detail.currentPeriod<=9?detail.currentPeriod:null;
      summary.groupColor=game.groupColor;
      summary.phaseLogoUrl=sportingImage(detail.Phase?.logoUrl);
      summary.organizationLogoUrl=sportingImage(detail.Organization?.logoUrl);
    }
    // Existing Příklepy are read from storage, never regenerated on refresh.
    if(options.refresh && env.DATABASE_URL) {
      const stored=await (options.loadSnapshot??loadGameSnapshot)(gameId,{env});
      if(stored) { assertOrg(stored.game.organization_id,config.id); summary.priklepy=buildGameSummary(stored).priklepy; }
    }
    if(!summary.home.logoUrl||!summary.away.logoUrl||!summary.competitionLogoUrl||!summary.groupLogoUrl||(summary.players??[]).some(p=>!p.imageUrl))publicMetadata??=await (options.fetchMetadata??fetchPublicGameMetadata)(gameId);
    applyPublicMedia(summary,publicMetadata);
    if((!summary.competitionLogoUrl||!summary.groupLogoUrl)&&config.token){
      try {const detail=await (options.fetchBrandingDetail??fetchGameDetail)(gameId,{config:{...hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token}),timeoutMs:4000,retries:0}});
        assertOrg(detail.organizationId,config.id);if(!same(detail.gameId,gameId))throw new Error('Jiný zápas');
        const brand=hmsMediaContext(detail);
        if(brand.competitionName===summary.competition)summary.competitionLogoUrl ||=brand.competitionLogoUrl;
        if(brand.groupName===summary.group)summary.groupLogoUrl ||=brand.groupLogoUrl;
        if(brand.phaseName===summary.phase)summary.phaseLogoUrl ||=brand.phaseLogoUrl;
      }catch{/* Optional branding never changes verified scores. */}
    }
    summary.organizationLogoUrl ||=await organizationImage(config,env,options);
    const value={...summary,org,readAt:new Date().toISOString(),source:snapshot?'imported-snapshot':'HMS-read-only'};
    cache.set(key,{expires:now+30000,refreshedAt:snapshot?0:now,value});
    if(cache.size>200) cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(key,task);
  try {return await task;} finally {pending.delete(key);}
}
