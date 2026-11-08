import {resolveJerseyTeam} from './jersey-context.mjs';
// Team colour is bound only to distinct, explicit jerseys in this exact HMS game.
export function suggestPlayers(players, observations, teams=[]) {
  if (!Array.isArray(players) || !Array.isArray(observations)) throw new TypeError('Expected arrays');
  return observations.map((observation,index) => {
    const strongNumber=String(observation?.jerseyNumber ?? '').trim(),weakNumber=String(observation?.observedNumber ?? '').trim();
    const tentative=!/^\d{1,3}$/.test(strongNumber) && observation?.confidence>=0.6 && /^\d{1,3}$/.test(weakNumber);
    const number=tentative?weakNumber:strongNumber,hasNumber=/^\d{1,3}$/.test(number);
    const teamId=observation?.teamId || resolveJerseyTeam(observation,teams);
    const role=observation?.roleConfidence>=0.85?observation.role:'unknown';
    if(!hasNumber && role!=='goalie')return {index,status:'unassigned',candidates:[],reason:'number_not_visible',teamId};
    const matches = players.filter(p => (!hasNumber || String(p.jerseyNumber ?? '').trim() === number)
      && (!teamId || p.teamId.toLowerCase() === teamId.toLowerCase())
      && (role==='goalie'?p.role==='goalie':role==='skater'?p.role!=='goalie':true));
    if (!matches.length) return {index,status:'unassigned',candidates:[],reason:'not_on_lineup'};
    // Without explicit verified team context, duplicate numbers are ambiguous.
    const reason=tentative?'tentative_number':!hasNumber?'goalie_without_number':matches.length!==1?'ambiguous_number':'single_roster_candidate_unverified';
    return {index,status:'review',candidates:matches,reason,teamId,tentative:tentative || !hasNumber,role};
  });
}
