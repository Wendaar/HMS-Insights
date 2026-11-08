// Conservative, non-biometric jersey-number candidate matching.
// All inputs are explicit observations: never infer a team from jersey colour alone.
export function suggestPlayers(players, observations) {
  if (!Array.isArray(players) || !Array.isArray(observations)) throw new TypeError('Expected arrays');
  return observations.map((observation,index) => {
    const number = String(observation?.jerseyNumber ?? '').trim();
    const teamId = observation?.teamId || null;
    if (!/^\d{1,3}$/.test(number)) return {index,status:'unassigned',candidates:[],reason:'number_not_visible'};
    const matches = players.filter(p => String(p.jerseyNumber ?? '').trim() === number
      && (!teamId || p.teamId === teamId));
    if (!matches.length) return {index,status:'unassigned',candidates:[],reason:'not_on_lineup'};
    // Without explicit verified team context, duplicate numbers are ambiguous.
    if (matches.length !== 1) return {index,status:'review',candidates:matches,reason:'ambiguous_number'};
    return {index,status:'review',candidates:matches,reason:'single_roster_candidate_unverified'};
  });
}
