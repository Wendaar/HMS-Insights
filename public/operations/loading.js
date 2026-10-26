// Stateful, memory-only page reader: commit a page atomically and resume at its cursor.
export function operationsLoad(org, range) {
  return {org, range: {...range}, offset: 0, games: [], ids: new Set(), complete: false, last: null};
}
export function commitOperationsPage(state, page) {
  if (page.organizationSlug !== state.org.toLowerCase() || page.offset !== state.offset || !Array.isArray(page.games) || typeof page.hasMore !== 'boolean') throw Error('Zdroj nepotvrdil organizaci a stránkování dat.');
  const ids = page.games.map(game => typeof game.id === 'string' ? game.id.toLowerCase() : '');
  if (ids.some(id => !id || state.ids.has(id)) || new Set(ids).size !== ids.length) throw Error('HMS vrátilo duplicitní stránku. Neúplné součty se nezobrazují.');
  if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset < state.offset + page.games.length || page.hasMore && (page.nextOffset <= state.offset || page.nextOffset > 3000)) throw Error('Období je příliš velké nebo se načítání neposunulo.');
  if (!page.hasMore && !page.complete) throw Error('HMS nepotvrdilo úplnost období.');
  for (const id of ids) state.ids.add(id);
  state.games.push(...page.games); state.offset = page.nextOffset; state.last = page; state.complete = !page.hasMore;
}
export async function continueOperationsLoad(state, {readPage, current = () => true, progress = () => {}, pause = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  while (!state.complete && current()) {
    let page;
    for (let attempt = 0; ; attempt++) {
      try { page = await readPage(state.offset); break; }
      catch (error) {
        if (!current() || !error.retryable || attempt >= 2) throw error;
        const delay = Math.min(30000, Math.max(500, Number(error.retryAfter) * 1000 || (attempt + 1) * 1000));
        progress(state.games.length, delay); await pause(delay);
        if (!current()) return false;
      }
    }
    if (!current()) return false;
    commitOperationsPage(state, page); progress(state.games.length, 0);
  }
  return state.complete && current();
}
