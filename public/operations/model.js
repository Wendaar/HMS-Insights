// Shared read-only Operations model. Team billing and per-side game payments stay separate.
export const dateValid = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export const shift = (value, days) => {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function periods(from, to) {
  if (!dateValid(from) || !dateValid(to) || from > to) throw new TypeError('Vyberte platné období.');
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > 93) throw new TypeError('Vyberte nejvýše 93 dní.');
  return {previous: {from: shift(from, -days), to: shift(from, -1)}, selected: {from, to}, next: {from: shift(to, 1), to: shift(to, days)}};
}
const clean = value => typeof value === 'string' ? value.trim().slice(0, 160) : '';
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const atPath = (object, key) => key?.split('.').reduce((value, part) => value?.[part], object);
const tokens = value => fold(value).split(/[^a-z0-9]+/).filter(Boolean);
export function people(value) {
  if (value === undefined) return null;
  return [...new Set((Array.isArray(value) ? value : [value]).flatMap(person =>
    typeof person === 'string' ? person.split(/[;,\n]+/) : person && typeof person === 'object' ?
      [person.name || [person.firstName, person.lastName].filter(Boolean).join(' ')] : []
  ).map(clean).filter(Boolean))];
}
export function teamCash(team, rules = {}) {
  const paths = rules.cashPath ? [rules.cashPath] : ['foreignId', 'foreingId', 'externalId'];
  const value = paths.map(path => atPath(team, path)).find(v => v !== undefined && v !== null);
  if (value === undefined) return null;
  const markers = tokens(value);
  if ((rules.cashValues ?? [rules.cashValue ?? 'CASH', 'HOTOVĚ']).some(marker => markers.includes(fold(marker)))) return true;
  if ((rules.invoiceValues ?? ['FAKTURY', 'FAKTURA', 'INVOICE']).some(marker => markers.includes(fold(marker)))) return false;
  return null;
}
export const paymentPaths = {
  home: ['paymentHost', 'paymentHome', 'homeTeamPayment', 'homePayment', 'paymentHomeTeam', 'HomeTeamPayment'],
  away: ['paymentGuest', 'paymentAway', 'awayTeamPayment', 'awayPayment', 'paymentAwayTeam', 'AwayTeamPayment']
};
export function sidePaid(game, side, rules = {}) {
  const paths = rules[side + 'PaidPath'] ? [rules[side + 'PaidPath']] : paymentPaths[side];
  const value = paths.map(path => atPath(game, path)).find(v => v !== undefined && v !== null);
  if (value === undefined) return null;
  if (rules.paidValue !== undefined && value === rules.paidValue) return true;
  if (rules.unpaidValues?.includes(value)) return false;
  const status = typeof value === 'string' ? value.trim().toUpperCase().replace(/[_-]+/g, ' ') : '';
  if (status === 'PAID') return true;
  if (['NOT PAID', 'UNPAID'].includes(status)) return false;
  return null;
}
export function normalizeGame(game, rules = {}) {
  const team = (value, id, side) => ({id: clean(value?.teamId ?? id), name: clean(value?.name), cash: teamCash(value, rules), paid: sidePaid(game, side, rules)});
  const competition = game.Phase?.Group?.Season?.Competition ?? game.Competition;
  return {
    id: game.gameId, date: game.startDate, time: clean(game.startTime).slice(0, 5), status: clean(game.status).toUpperCase(),
    home: team(game.HomeTeam, game.homeTeamId, 'home'), away: team(game.AwayTeam, game.awayTeamId, 'away'),
    teamsKnown: (Object.hasOwn(game, 'HomeTeam') || Object.hasOwn(game, 'homeTeamId')) && (Object.hasOwn(game, 'AwayTeam') || Object.hasOwn(game, 'awayTeamId')),
    competitionId: clean(competition?.competitionId ?? game.competitionId), competition: clean(competition?.name) || 'Soutěž neurčena',
    venue: clean(game.Venue?.name), referees: people(game.referee), timekeepers: people(game.timekeeper)
  };
}
export const inactive = game => ['CANCELLED', 'CANCELED', 'DELETED'].includes(game.status);
export const paymentLabel = cash => cash === true ? 'CASH / HOTOVĚ' : cash === false ? 'FAKTURY' : 'K ověření';
export const paidLabel = paid => paid === true ? 'PAID' : paid === false ? 'NOT PAID' : 'API neuvádí';
export function paymentIssues(game, today) {
  if (inactive(game) || game.date >= today) return [];
  return [['home', game.home], ['away', game.away]].filter(([, team]) => team.id && team.cash === true && team.paid !== true).map(([side, team]) => ({
    gameId: game.id, teamId: team.id, side, team: team.name || 'Tým bez názvu', date: game.date, time: game.time,
    competition: game.competition, venue: game.venue,
    opponent: (side === 'home' ? game.away.name : game.home.name) || 'Chybí soupeř',
    payment: team.paid === false ? 'NOT PAID · ověřit úhradu' : 'Úhrada týmu není v API',
    confirmedUnpaid: team.paid === false
  }));
}
export function warnings(game, today) {
  if (inactive(game)) return [];
  const result = [];
  if (game.referees === null || game.timekeepers === null) result.push('staff_unknown');
  if (game.referees?.length === 0) result.push('referee');
  if (game.timekeepers?.length === 0) result.push('timekeeper');
  if (game.teamsKnown && (!game.home.id || !game.away.id)) result.push(game.date >= today ? 'ice' : 'past_teams');
  if (!game.teamsKnown) result.push('teams_unknown');
  const payments = paymentIssues(game, today);
  if (payments.some(row => row.confirmedUnpaid)) result.push('cash');
  if (payments.some(row => !row.confirmedUnpaid)) result.push('payment_unknown');
  if (game.date < today && [game.home, game.away].some(team => team.id && team.cash === null)) result.push('cash_unknown');
  if (!game.competitionId && game.competition === 'Soutěž neurčena') result.push('competition_unknown');
  return result;
}
export const warningLabels = {
  referee: 'Chybí rozhodčí', timekeeper: 'Chybí časoměřič', ice: 'Volný led · chybí soupeř', past_teams: 'Minulý zápas bez soupeře',
  cash: 'HOTOVĚ · tým nemá PAID', payment_unknown: 'HOTOVĚ · úhrada týmu není v API', cash_unknown: 'Platební režim týmu k ověření',
  staff_unknown: 'Personál není ve zdroji', teams_unknown: 'Týmy nejsou ve zdroji', competition_unknown: 'Soutěž není ve zdroji'
};
export function staffRanking(staff, period = 'selected', role = '') {
  const rows = new Map();
  for (const person of staff) {
    if (role && person.role !== role) continue;
    const count = person[period] ?? 0;
    if (!count) continue;
    const row = rows.get(person.name) ?? {name: person.name, total: 0, competitions: {}};
    row.competitions[person.competition] = (row.competitions[person.competition] ?? 0) + count;
    row.total += count; rows.set(person.name, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'cs'));
}
export function aggregate(games, range, {competition = '', q = '', today, payment = ''} = {}) {
  const windows = periods(range.from, range.to);
  const matchesPayment = team => !payment || (payment === 'cash' ? team.cash === true : payment === 'invoice' ? team.cash === false : team.cash === null);
  const filtered = games.filter(game => (!competition || (game.competitionId || game.competition) === competition) &&
    (!payment || [game.home, game.away].some(matchesPayment)) &&
    (!q || fold([game.home.name, game.away.name, ...game.referees ?? [], ...game.timekeepers ?? []].join(' ')).includes(fold(q))));
  const inWindow = (game, window) => game.date >= window.from && game.date <= window.to;
  const selected = filtered.filter(game => inWindow(game, windows.selected)).map(game => ({...game, warnings: warnings(game, today)}));
  const staff = new Map(), teams = new Map();
  for (const game of filtered) {
    if (inactive(game)) continue;
    const period = Object.keys(windows).find(key => inWindow(game, windows[key]));
    if (!period) continue;
    for (const [role, names] of [['Rozhodčí', game.referees], ['Časoměřič', game.timekeepers]]) for (const name of names ?? []) {
      const key = JSON.stringify([name, role, game.competitionId || game.competition]);
      const row = staff.get(key) ?? {name, role, competition: game.competition, previous: 0, selected: 0, next: 0};
      row[period]++; staff.set(key, row);
    }
  }
  for (const game of selected) {
    if (inactive(game)) continue;
    for (const team of [game.home, game.away]) {
      if (!team.id || !matchesPayment(team) || (q && !fold(team.name).includes(fold(q)))) continue;
      const key = JSON.stringify([team.id, game.competitionId || game.competition]);
      const row = teams.get(key) ?? {id: team.id, team: team.name || 'Tým bez názvu', competition: game.competition, games: 0, cash: team.cash};
      if (row.cash !== team.cash) row.cash = null;
      row.games++; row.payment = paymentLabel(row.cash); teams.set(key, row);
    }
  }
  return {
    games: selected, staff: [...staff.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    teams: [...teams.values()].sort((a, b) => a.team.localeCompare(b.team, 'cs')),
    cashIssues: selected.flatMap(game => paymentIssues(game, today)).filter(row => (!payment || payment === "cash") && (!q || fold(row.team).includes(fold(q)))), windows
  };
}
export function csv(rows, columns) {
  const cell = value => '"' + String(value ?? '').replaceAll('"', '""').replace(/^(?:\s*[=+@\-]|[\t\r])/, "'$&") + '"';
  return '\ufeff' + [columns.map(column => cell(column[1])).join(';'), ...rows.map(row => columns.map(([key]) => cell(Array.isArray(row[key]) ? row[key].join(', ') : row[key])).join(';'))].join('\r\n');
}
