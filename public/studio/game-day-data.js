// Assemble one complete calendar day before enabling filters or export. Each
// request remains bounded by the existing server's 20-fixture page contract.
export async function allDayFixtures(fetchPage, {org, date, signal, maxPages = 6}) {
  const items = [], seen = new Set();
  let source;
  for (let page = 0; page < maxPages; page++) {
    signal?.throwIfAborted();
    const data = await fetchPage(page * 20);
    signal?.throwIfAborted();
    if (!Array.isArray(data.items) || data.items.length > 20 || typeof data.hasMore !== 'boolean') {
      throw new Error('Invalid Game Day page.');
    }
    if (source !== undefined && source !== data.source) throw new Error('Game Day source changed. Reload.');
    source = data.source;
    for (const fixture of data.items) {
      const id = String(fixture.gameId ?? '').toLowerCase();
      if (!id || seen.has(id) || fixture.org !== org || fixture.date !== date) {
        throw new Error('Game Day contains duplicate or out-of-scope fixtures. Reload.');
      }
      seen.add(id);
      items.push(fixture);
      if (items.length > 100) throw new Error('More than 100 fixtures in this day. Export is disabled to avoid an incomplete schedule.');
    }
    if (!data.hasMore) return {items, source};
    if (!data.items.length) throw new Error('Game Day paging did not advance.');
  }
  throw new Error('More than 100 fixtures in this day. Export is disabled to avoid an incomplete schedule.');
}

export function shiftCalendarDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value.getTime()) || value.toISOString().slice(0,10) !== date) {
    throw new Error('Invalid calendar date.');
  }
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0,10);
}
