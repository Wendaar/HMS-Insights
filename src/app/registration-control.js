import {PHM_ORGANIZATION_ID} from './organizations.js';

// Scope from the prior portal metadata probe; reverify upstream before enabling.
// All authorization uses immutable IDs, never display names or caller input.
export const REGISTRATION_SCOPE = Object.freeze({organizationId: PHM_ORGANIZATION_ID.toLowerCase(),
  competitionId: 'c7c0bb15-5d29-415d-851e-5d777c6cc621',
  seasonId: 'e6134160-47cf-11f1-a223-bfdfbdd3a64b', label: 'PHM Cup · 2026/27'});
export const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
export const sameId = (a, b) => uuid(a) && uuid(b) && a.toLowerCase() === b.toLowerCase();
const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, max) : '';
const bool = value => typeof value === 'boolean' ? value : null;
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const photos = new Set(['prod-hms-wootera.s3.eu-central-1.amazonaws.com', 'hockeymanagementsystem.s3.amazonaws.com']);
function photo(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && photos.has(url.hostname) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function registrationPlayer(member, scope = REGISTRATION_SCOPE) {
  if (!uuid(member?.playerId)) throw Error('Registration source integrity');
  if (!Array.isArray(member.invitations)) throw Error('Registration invitation coverage missing');
  const invitations = member.invitations.filter(i => sameId(i.seasonId, scope.seasonId));
  const latestInvite = invitations.map(i => date(i.sentAt)).filter(Boolean).sort().at(-1) ?? null;
  if (!['ACTIVE', 'INVITED'].includes(member.status) || member.status === 'INVITED' && !invitations.length) return null;
  const registration = sameId(member.registration?.seasonId, scope.seasonId) ? member.registration : null;
  const accepted = bool(registration?.acceptedByPlayer);
  const method = text(registration?.paymentMethod, 64) || null;
  const paid = registration?.paymentStatus === 'PAID' ? true : registration?.paymentStatus === 'UNPAID' ? false : null;
  const confirmed = registration?.status === 'CONFIRMED' ? true : registration?.status ? false : null;
  const actions = [];
  if (!registration) actions.push('Chybí registrace pro sezonu 2026/27 v připojeném zdroji.');
  if (!invitations.length) actions.push('V HMS není evidována pozvánka do sezony 2026/27.');
  if (registration) {
    if (accepted === false) actions.push('Hráč musí přijmout podmínky registrace.');
    if (accepted === null) actions.push('HMS neposkytlo údaj o přijetí podmínek.');
    if (!method) actions.push('Ověřit nebo doplnit platební metodu v HMS.');
    if (paid === false) actions.push(method === 'CASH' ? 'Platí manažer: úhrada zatím není v HMS potvrzena.' : 'Úhrada zatím není v HMS potvrzena.');
    if (paid === null) actions.push('HMS neposkytlo ověřený stav úhrady.');
    if (confirmed !== true) actions.push(registration.status ? 'Registrace čeká na potvrzení v HMS (' + text(registration.status, 64) + ').' : 'HMS neposkytlo stav potvrzení registrace.');
  }
  // A confirmed registration can still contain contradictory/unknown fields.
  return {playerId: member.playerId.toLowerCase(), name: text(member.name) || 'Jméno není dostupné',
    photoUrl: photo(member.photoUrl), email: text(member.email, 254) || null, memberStatus: member.status,
    invited: invitations.length > 0, latestInvite, accepted, paymentMethod: method,
    paid, confirmed, ok: confirmed === true && accepted === true && paid === true && !!method && invitations.length > 0,
    actions};
}

export function normalizeRegistrationPages(pages, scope = REGISTRATION_SCOPE) {
  const teams = new Map();
  for (const page of pages) {
    if (page?.schemaVersion !== 1 || !sameId(page.organizationId, scope.organizationId) ||
      !sameId(page.competitionId, scope.competitionId) || !sameId(page.seasonId, scope.seasonId) ||
      page.complete !== true || !Array.isArray(page.teams)) throw Error('Registration source scope or coverage mismatch');
    for (const team of page.teams) {
      if (!uuid(team.teamId) || typeof team.name !== 'string' || !Array.isArray(team.members)) throw Error('Registration team integrity');
      const id = team.teamId.toLowerCase();
      let target = teams.get(id);
      if (!target) { target = {teamId: id, name: text(team.name), players: [], seen: new Set()}; teams.set(id, target); }
      if (target.name !== text(team.name)) throw Error('Conflicting registration team');
      for (const member of team.members) {
        if (!uuid(member?.playerId) || target.seen.has(member.playerId.toLowerCase())) throw Error('Duplicate or invalid registration member');
        target.seen.add(member.playerId.toLowerCase());
        const player = registrationPlayer(member, scope);
        if (player) target.players.push(player);
      }
    }
  }
  return [...teams.values()].map(({seen, ...team}) => ({...team, players: team.players.sort((a,b) => a.name.localeCompare(b.name, 'cs'))})).sort((a,b) => a.name.localeCompare(b.name, 'cs'));
}

export class RegistrationSourceError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// Enable only after an authorized reader/bridge implements the verified contract.
// No guessed internal HMS endpoint or scraped personal HMS login is used.
export async function readRegistrationTeams({env = process.env, fetchImpl = fetch, scope = REGISTRATION_SCOPE} = {}) {
  if (env.HMS_PHM_REGISTRATIONS_VERIFIED !== 'true' || !env.HMS_PHM_REGISTRATIONS_URL) throw new RegistrationSourceError('source_not_verified');
  const url = new URL(env.HMS_PHM_REGISTRATIONS_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new RegistrationSourceError('source_configuration');
  const token = env.HMS_PHM_REGISTRATIONS_API_TOKEN || (url.origin === 'https://public-api.prod.hms.wootera.net' ? env.HMS_PHM_API_TOKEN || env.HMS_API_TOKEN : null);
  if (!token) throw new RegistrationSourceError('source_configuration');
  const pages = [], seen = new Set();
  let cursor = null, count = 0, totalBytes = 0;
  const deadline = AbortSignal.timeout(45000);
  do {
    const request = new URL(url);
    for (const [key,value] of Object.entries(scope)) if (key !== 'label') request.searchParams.set(key, value);
    if (cursor) request.searchParams.set('cursor', cursor);
    const response = await fetchImpl(request, {headers: {authorization: 'Bearer ' + token, accept: 'application/json'},
      redirect: 'error', cache: 'no-store', signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)])});
    if (!response.ok) throw new RegistrationSourceError(response.status === 429 ? 'source_rate_limit' : 'source_unavailable');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new RegistrationSourceError('source_integrity');
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) { bytes += chunk.length; totalBytes += chunk.length; if (bytes > 5_000_000 || totalBytes > 10_000_000) throw new RegistrationSourceError('source_integrity'); chunks.push(chunk); }
    const page = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    pages.push(page);
    count += page.teams?.reduce((n,t) => n + (t.members?.length ?? 0), 0) ?? 0;
    if (count > 20000 || !Object.hasOwn(page, 'nextCursor')) throw new RegistrationSourceError('source_integrity');
    cursor = page.nextCursor;
    if (cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 512 || seen.has(cursor) || pages.length >= 50)) throw new RegistrationSourceError('source_integrity');
    seen.add(cursor);
  } while (cursor !== null);
  return normalizeRegistrationPages(pages, scope);
}
