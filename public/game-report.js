import { filterReportEvents, goalZoneCounts, situationCounts, durationLabel } from './game-report-data.js';

const payload = document.getElementById('game-report-data');
const { summary, catalog } = JSON.parse(payload.textContent);
const events = summary.timeline?.events ?? [];
const byId = new Map(events.map((event) => [event.id, event]));
const $ = (id) => document.getElementById(id);
const rail = $('event-rail');
const dialog = $('event-dialog');
const filters = { team: 'all', period: 'all', type: 'all' };
const teamName = (id) => [summary.home, summary.away].find((team) => team.id.toLowerCase() === id?.toLowerCase())?.name ?? 'Tým neuveden';
const behavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

function refresh() {
  const visible = new Set(filterReportEvents(events, filters).map((event) => event.id));
  for (const item of document.querySelectorAll('.rail-item')) item.hidden = !visible.has(item.dataset.eventId);
  $('rail-count').textContent = `${visible.size} událostí`;
  $('rail-empty').hidden = visible.size > 0;
  $('clear-zone-filter').hidden = !filters.zoneKind;
  const goals = filterReportEvents(events, { team: filters.team, period: filters.period, type: 'goal' });
  for (const field of ['shotZone', 'netZone']) {
    const counts = goalZoneCounts(goals, field, catalog[field]);
    const map = document.querySelector(`[data-map="${field}"]`);
    map.querySelector('.map-coverage').textContent = `${counts.mapped}/${counts.total}`;
    map.querySelector('.unknown-count').textContent = counts.unknown;
    const max = Math.max(1, ...Object.values(counts.counts));
    for (const zone of map.querySelectorAll('[data-zone]')) {
      const code = zone.dataset.zone;
      zone.setAttribute('aria-pressed', String(filters.zoneKind === field && filters.zoneCode === code));
      if (code === 'unknown') continue;
      const count = counts.counts[code];
      zone.setAttribute('class', `map-zone heat-${count ? Math.ceil(count / max * 5) : 0}`);
      zone.querySelector('.zone-count').textContent = count;
      const label = catalog[field].find((item) => item.code === code).label;
      zone.setAttribute('aria-label', `${label}: ${count} gólů`);
      zone.querySelector('title').textContent = `${label}: ${count} gólů`;
    }
  }
  const strength = situationCounts(goals);
  $('pp-recorded').textContent = strength.recorded.PP;
  $('sh-recorded').textContent = strength.recorded.SH;
  $('strength-estimated').textContent = `${strength.estimated.PP} / ${strength.estimated.SH}`;
  $('strength-unknown').textContent = strength.unknown;
}

function openEvent(id) {
  const event = byId.get(id);
  if (!event || !dialog) return;
  $('event-detail-kicker').textContent = event.type === 'goal' ? 'GÓL' : event.type === 'penalty' ? 'TREST' : 'ZÁKROK';
  $('event-detail-title').textContent = event.player.name ?? 'Hráč neuveden';
  $('event-detail-context').textContent = [teamName(event.teamId), event.period ? `${event.period}. část` : 'Část neuvedena', event.clock ?? 'Čas neuveden'].join(' · ');
  const list = document.createElement('dl');
  const row = (label, value) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value || 'Neuvedeno';
    list.append(dt, dd);
  };
  if (event.type === 'goal') {
    row('Skóre po gólu', event.scoreAfter ? `${event.scoreAfter.home}:${event.scoreAfter.away}` : null);
    row('Asistence', event.assists.map((player) => player.name ?? 'Hráč neuveden').join(', ') || 'Bez evidované asistence');
    row('Překonaný brankář', event.allowedBy?.name);
    row('Způsob střely', event.details?.shotType?.name);
    row('Provedení gólu', event.details?.goalSubtype?.name);
    row('Odkud', event.details?.shotZone?.label ?? event.details?.shotZone?.sourceName);
    row('Kam', event.details?.netZone?.label ?? event.details?.netZone?.sourceName);
    row('Početní situace', event.situation?.label);
    row('Určení situace', event.situation?.source === 'hms' ? 'Zapsáno v HMS' : event.situation?.source === 'penalty-model' ? 'Odhad podle časů a menších trestů' : 'Chybí dostatečné údaje');
  } else if (event.type === 'penalty') {
    row('Délka trestu', event.penaltyMinutes === null ? null : durationLabel(event.penaltyMinutes));
    row('Typ trestu', event.penaltyDetails?.type?.name);
    row('Přestupek', event.penaltyDetails?.subtype?.name);
  }
  $('event-detail-content').replaceChildren(list);
  const hash = `#event=${encodeURIComponent(id)}`;
  $('event-permalink').href = hash;
  history.replaceState(null, '', hash);
  if (!dialog.open) dialog.showModal();
}

if (rail) {
  for (const [id, field] of [['report-team', 'team'], ['report-period', 'period'], ['report-event-type', 'type']]) {
    $(id).addEventListener('change', (event) => {
      filters[field] = event.target.value;
      if (field === 'type' && filters.type !== 'goal') { delete filters.zoneKind; delete filters.zoneCode; }
      refresh(); rail.scrollLeft = 0;
    });
  }
  const scroll = (direction) => rail.scrollBy({ left: direction * Math.max(230, rail.clientWidth * .75), behavior: behavior() });
  $('rail-prev').addEventListener('click', () => scroll(-1));
  $('rail-next').addEventListener('click', () => scroll(1));
  rail.addEventListener('keydown', (event) => {
    if (event.target === rail && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); scroll(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  rail.addEventListener('click', (event) => { const button = event.target.closest('button[data-event-id]'); if (button) openEvent(button.dataset.eventId); });
  $('event-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (location.hash.startsWith('#event=')) history.replaceState(null, '', location.pathname + location.search); });
  for (const zone of document.querySelectorAll('[data-map-kind][data-zone]')) {
    const choose = () => {
      if (filters.zoneKind === zone.dataset.mapKind && filters.zoneCode === zone.dataset.zone) { delete filters.zoneKind; delete filters.zoneCode; }
      else { filters.zoneKind = zone.dataset.mapKind; filters.zoneCode = zone.dataset.zone; filters.type = 'goal'; $('report-event-type').value = 'goal'; }
      refresh(); rail.scrollIntoView({ behavior: behavior(), block: 'nearest' }); rail.scrollLeft = 0;
    };
    zone.addEventListener('click', choose);
    if (zone.tagName.toLowerCase() === 'g') zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
  }
  $('clear-zone-filter').addEventListener('click', () => { delete filters.zoneKind; delete filters.zoneCode; refresh(); });
  const fromHash = () => { if (location.hash.startsWith('#event=')) { try { openEvent(decodeURIComponent(location.hash.slice(7))); } catch {} } };
  window.addEventListener('hashchange', fromHash);
  refresh(); fromHash();
}
