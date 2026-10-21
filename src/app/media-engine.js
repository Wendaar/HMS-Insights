// Trigger-neutral read model. No writes to HMS, imported snapshots or Příklepy.
import { fetchGames, fetchGameResponses, hmsConfigFromEnv } from '../hms/client.js';
import { normalizeHmsGame } from '../hms/normalize.js';
import { buildGameSummary, isGameId } from '../domain/game-summary.js';
import { rowsFor } from '../infrastructure/analysis-rows.js';
import { loadGameSnapshot, loadStudioPage } from '../infrastructure/postgres-repository.js';
import { gameRows } from './backfill-finished-games.js';
import { sportingImage } from '../../public/game-report-media.js';

export const organizations = ['PHM','EUCHL','YHG','BNHLH'];
const cache = new Map();
const pending = new Map();
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
function listing(g) {
  const image = e => sportingImage(e?.logoUrls?.md ?? e?.logoUrl);
  return {gameId:g.gameId, playedOn:g.startDate, status:g.status,
    home:{name:g.HomeTeam?.name ?? 'Domácí',logoUrl:image(g.HomeTeam)},
    away:{name:g.AwayTeam?.name ?? 'Hosté',logoUrl:image(g.AwayTeam)}};
}
export async function browseMedia({org,filter='Today',offset=0,windowPage=0,section='games'}, options={}) {
  const env=options.env??process.env, config=organizationConfig(org,env);
  const range=timeWindow(filter,options.now,windowPage);
  const limit=20;
  if(section==='insights' || !config.token) {
    const page=await (options.loadPage??loadStudioPage)({organizationId:config.id,...range,offset,limit,section,env});
    if(section==='insights')page.items=page.items.map(item=>({
      id:item.id,gameId:item.gameId,type:item.type,title:item.title,text:item.text,date:item.date,
      player:item.player,team:item.team,playerImageUrl:sportingImage(item.playerImageUrl),teamLogoUrl:sportingImage(item.teamLogoUrl)
    }));
    return page;
  }
  const hmsConfig={...hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token}),token:config.token};
  const rows=gameRows(await (options.fetchGames??fetchGames)({...range,limit,skip:offset}, {config:hmsConfig}));
  if(rows.length>limit) throw new Error('HMS nerespektuje stránkování.');
  for(const g of rows) {
    assertOrg(g.organizationId,config.id);
    if(!isGameId(g.gameId) || !/^\d{4}-\d{2}-\d{2}$/.test(g.startDate??'') || g.startDate<range.from || g.startDate>range.to) throw new Error('HMS nerespektuje časový rozsah.');
  }
  return {items:rows.map(listing),hasMore:rows.length===limit,offset,source:'HMS',...range};
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
    if(snapshot) summary=buildGameSummary(snapshot);
    else {
      const hmsConfig=hmsConfigFromEnv({...env,HMS_API_TOKEN:config.token});
      const [detail,events,lineup,metadata]=await (options.fetchResponses??fetchGameResponses)(gameId,{config:hmsConfig});
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
    const value={...summary,org,readAt:new Date().toISOString(),source:snapshot?'imported-snapshot':'HMS-read-only'};
    cache.set(key,{expires:now+30000,refreshedAt:snapshot?0:now,value});
    if(cache.size>200) cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(key,task);
  try {return await task;} finally {pending.delete(key);}
}
