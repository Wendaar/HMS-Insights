const count = (value) => value !== null && value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export const percentage = (part, total) => total > 0 ? Math.round(part / total * 10000) / 100 : null;

export function buildFaceoffs(snapshot) {
  const value = snapshot?.faceoffs;
  const homeWins = count(value?.homeWins), awayWins = count(value?.awayWins), unattributed = count(value?.unattributed);
  const available = homeWins !== null && awayWins !== null && unattributed !== null;
  if (!available) return { available: false, homeWins: null, awayWins: null, total: null, homePercentage: null, awayPercentage: null, unattributed: null, source: null };
  const total = homeWins + awayWins + unattributed;
  return { available: true, homeWins, awayWins, total, unattributed,
    homePercentage: !unattributed ? percentage(homeWins, total) : null,
    awayPercentage: !unattributed ? percentage(awayWins, total) : null,
    source: ['hms-totals', 'hms-public-totals', 'recorded-events'].includes(value.source) ? value.source : null };
}

export function goalieStatistics(row) {
  const saves = count(row.saves), goalsAgainst = count(row.goals_against);
  const shotsAgainst = saves === null || goalsAgainst === null ? null : saves + goalsAgainst;
  return { saves, goalsAgainst, shotsAgainst, savePercentage: shotsAgainst === null ? null : percentage(saves, shotsAgainst), statisticsBasis: 'recorded-events' };
}
