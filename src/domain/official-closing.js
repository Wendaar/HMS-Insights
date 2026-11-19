// Pure, organisation-neutral Closing V1 domain rules.
// Persistence, HMS ownership verification and permissions belong to the API layer.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AWARDS = new Set(['points','goals','assists','mvp','goalie','defenseman']);
const cleanId = (value, field) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw new TypeError(field);
  return value.toLowerCase();
};
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const label = (value, field, max = 100) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\x00-\x1f]/.test(value)) throw new TypeError(field);
  return value.trim();
};

export function closingScope(input) {
  if (!plain(input)) throw new TypeError('scope');
  const organization = label(input.organization, 'organization', 50).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(organization)) throw new TypeError('organization');
  const seasonId = cleanId(input.seasonId, 'seasonId');
  const competitionId = cleanId(input.competitionId, 'competitionId');
  const type = input.type;
  if (!['competition','group','phase'].includes(type)) throw new TypeError('scope type');
  if (type === 'competition' && (input.groupId || input.phaseId)) throw new TypeError('competition scope');
  if (type === 'group' && (!input.groupId || input.phaseId)) throw new TypeError('group scope');
  if (type === 'phase' && !input.phaseId) throw new TypeError('phase scope');
  return {organization, seasonId, competitionId, type,
    ...(input.groupId ? {groupId: cleanId(input.groupId, 'groupId')} : {}),
    ...(input.phaseId ? {phaseId: cleanId(input.phaseId, 'phaseId')} : {}),
    ...(input.groupId && type === 'phase' ? {groupId: cleanId(input.groupId, 'groupId')} : {})};
}

// rank is an official placement, not an index: joint placements are supported.
// Medal labels are explicit, because not every group/phase grants medals.
export function closingStandings(rows, eligibleTeamIds, {allowUnplaced=false}={}) {
  if (!Array.isArray(rows) || rows.length > 256 || !Array.isArray(eligibleTeamIds)) throw new TypeError('standings');
  const eligible = new Set(eligibleTeamIds.map(id => cleanId(id, 'eligible team')));
  const seen = new Set();
  return rows.map(row => {
    if (!plain(row)) throw new TypeError('standing');
    const teamId = cleanId(row.teamId, 'teamId');
    if (!eligible.has(teamId) || seen.has(teamId)) throw new TypeError('duplicate or ineligible team');
    seen.add(teamId);
    const unplaced=allowUnplaced&&row.rank==null;
    if (!unplaced&&(!Number.isInteger(row.rank) || row.rank < 1 || row.rank > 256)) throw new TypeError('rank');
    const medal = row.medal ?? null;
    if (![null, 'gold', 'silver', 'bronze'].includes(medal)) throw new TypeError('medal');
    if(unplaced&&medal)throw new TypeError('unplaced medal');
    return {teamId, rank: unplaced?null:row.rank, medal};
  }).sort((a,b) => (a.rank??257) - (b.rank??257) || a.teamId.localeCompare(b.teamId));
}

export function closingAwards(rows, eligiblePlayerTeamPairs) {
  if (!Array.isArray(rows) || rows.length > 100 || !Array.isArray(eligiblePlayerTeamPairs)) throw new TypeError('awards');
  const eligible = new Set(eligiblePlayerTeamPairs.map(({playerId,teamId}) => cleanId(playerId,'playerId')+'|'+cleanId(teamId,'teamId')));
  const keys = new Set();
  return rows.map(row => {
    if (!plain(row)) throw new TypeError('award');
    const category = label(row.category, 'category', 60).toLowerCase();
    if (!AWARDS.has(category) && !/^custom:[a-z0-9-]{1,40}$/.test(category)) throw new TypeError('category');
    const playerId = cleanId(row.playerId, 'playerId');
    const teamId = cleanId(row.teamId, 'teamId');
    if (!eligible.has(playerId+'|'+teamId)) throw new TypeError('ineligible player');
    if (keys.has(category)) throw new TypeError('duplicate category');
    keys.add(category);
    return {category, playerId, teamId, ...(category.startsWith('custom:') ? {title: label(row.title,'title')} : {})};
  });
}

export function closingDraft(input, eligibility) {
  if (!plain(input) || !plain(eligibility)) throw new TypeError('draft');
  return {
    title: label(input.title, 'title'),
    scope: closingScope(input.scope),
    standings: closingStandings(input.standings ?? [], eligibility.teamIds,{allowUnplaced:true}),
    awards: closingAwards(input.awards ?? [], eligibility.playerTeamPairs),
    allStarsPublicationId: input.allStarsPublicationId == null ? null : label(input.allStarsPublicationId,'allStarsPublicationId'),
    status: 'draft',
    published: false
  };
}

// Freeze a detached copy: subsequent source edits cannot mutate an approved snapshot.
export function approveClosing(draft, {actorId, approvedAt, version} = {}) {
  if (!plain(draft) || draft.status !== 'draft') throw new TypeError('draft status');
  if (!Array.isArray(draft.standings) || !draft.standings.length) throw new TypeError('empty standings');
  if(draft.standings.some(r=>!Number.isInteger(r.rank)||r.rank<1))throw new TypeError('unplaced standings');
  if (!Number.isInteger(version) || version < 1) throw new TypeError('version');
  const snapshot = structuredClone({...draft, status:'closed', published:false,
    approval: {actorId: cleanId(actorId,'actorId'), approvedAt: label(approvedAt,'approvedAt',40), version}});
  if (Number.isNaN(Date.parse(snapshot.approval.approvedAt))) throw new TypeError('approvedAt');
  return deepFreeze(snapshot);
}

function deepFreeze(object) {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) {
    for (const value of Object.values(object)) deepFreeze(value);
    Object.freeze(object);
  }
  return object;
}
