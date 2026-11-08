import {fetchGameDetail,fetchGameLineup,hmsConfigFromEnv} from '../src/hms/client.js';

export function normalizeLineup(gameId,detail,lineup) {
  const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
  if (!equal(detail?.gameId,gameId)) throw new Error('HMS detail game identity missing or mismatched');
  if (lineup?.gameId && !equal(lineup.gameId,gameId)) throw new Error('HMS returned a lineup for a different game');
  const rows = Array.isArray(lineup) ? lineup : lineup?.Lineups;
  if (!Array.isArray(rows)) throw new Error('HMS lineup response has no Lineups array');
  const homeTeamId = detail.homeTeamId ?? detail.HomeTeam?.teamId;
  const awayTeamId = detail.awayTeamId ?? detail.AwayTeam?.teamId;
  if (!homeTeamId || !awayTeamId) throw new Error('HMS game has no team identities');
  const players = [];
  const goalieIds=new Set([...(detail.GameEventSaves || []).filter(e=>!e.isDeleted).map(e=>e.savedByPlayerId),...(detail.GameEventGoals || []).filter(e=>!e.isDeleted).map(e=>e.allowedByPlayerId)].filter(Boolean).map(id=>id.toLowerCase()));
  for (const row of rows) {
    if (row.isDeleted) continue;
    if (row.gameId && !equal(row.gameId,gameId)) throw new Error('HMS lineup row belongs to a different game');
    const playerId = row.playerId ?? row.Player?.playerId;
    if (row.playerId && row.Player?.playerId && !equal(row.playerId,row.Player.playerId)) throw new Error('Conflicting HMS player identities');
    if (!playerId || !row.teamId) continue;
    if (![homeTeamId,awayTeamId].some(id=>equal(id,row.teamId))) throw new Error('HMS lineup team is not in this game');
    const isGoalie=row.ListPosition?.isGoalie===true || goalieIds.has(playerId.toLowerCase());
    const role=isGoalie?'goalie':row.ListPosition?.isGoalie===false?'skater':'unknown';
    players.push({playerId,teamId:row.teamId,jerseyNumber:row.number == null?null:String(row.number),role,
      name:[row.Player?.firstName,row.Player?.lastName].filter(Boolean).join(' ').trim() || row.name || null});
  }
  if (!players.length) throw new Error('HMS lineup contains no usable players');
  return {gameId,homeTeamId,awayTeamId,players};
}

export async function fetchLineup(gameId,{env=process.env,fetchImpl=fetch}={}) {
  const config = {...hmsConfigFromEnv(env),timeoutMs:20000,retries:0};
  if (new URL(config.baseUrl).protocol !== 'https:') throw new Error('HMS API requires HTTPS');
  const options = {config,fetchImpl:(url,init)=>fetchImpl(url,{...init,redirect:'error'})};
  const [detail,lineup] = await Promise.all([fetchGameDetail(gameId,options),fetchGameLineup(gameId,options)]);
  return normalizeLineup(gameId,detail,lineup);
}
