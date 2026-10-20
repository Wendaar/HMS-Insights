// Pure display helpers shared by server rendering and the browser. No credentials,
// network requests or raw HMS data belong in this module.
export function durationLabel(minutes) {
  if (!Number.isFinite(minutes)) return '? min';
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
}
export function filterReportEvents(events, filters = {}) {
  return events.filter((event) => {
    if (filters.type && filters.type !== "all" ? event.type !== filters.type : event.type === "save") return false;
    if (filters.team && filters.team !== "all" && event.teamId?.toLowerCase() !== filters.team.toLowerCase()) return false;
    if (filters.period && filters.period !== "all" && String(event.period ?? "unknown") !== String(filters.period)) return false;
    if (filters.zoneKind) {
      if (event.type !== "goal") return false;
      const code = event.details?.[filters.zoneKind]?.code ?? "unknown";
      if (code !== filters.zoneCode) return false;
    }
    return true;
  });
}

export function goalZoneCounts(events, field, catalog) {
  const goals = events.filter((event) => event.type === "goal");
  const counts = Object.fromEntries(catalog.map((zone) => [zone.code, 0]));
  let unknown = 0;
  for (const event of goals) {
    const code = event.details?.[field]?.code;
    if (Object.hasOwn(counts, code)) counts[code]++;
    else unknown++;
  }
  return { total: goals.length, mapped: goals.length - unknown, unknown, counts };
}

export function situationCounts(events) {
  const result = { recorded: { PP: 0, SH: 0, EV: 0, OTHER: 0 }, estimated: { PP: 0, SH: 0, EV: 0 }, unknown: 0, total: 0 };
  for (const event of events.filter((item) => item.type === "goal")) {
    result.total++;
    const situation = event.situation;
    if (situation?.source === "hms" && Object.hasOwn(result.recorded, situation.code)) result.recorded[situation.code]++;
    else if (situation?.source === "penalty-model" && Object.hasOwn(result.estimated, situation.code)) result.estimated[situation.code]++;
    else result.unknown++;
  }
  return result;
}
