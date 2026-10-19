import { eventClock, eventPeriod } from "./event-snapshot.js";

const entities = { goal: "GameEventGoal", penalty: "GameEventPenalty", save: "GameEventSave" };
const fields = ["ListShotType", "ListGoalType", "ListGoalSubtype", "ListEventLocation", "ListGoalLocation", "ListPenaltyType", "ListPenaltySubtype"];
const clean = (value) => typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
function fingerprint(event, type) {
  const clock = eventClock(event.gameTime);
  const team = event.scoredByTeamId ?? event.penalizedTeamId ?? event.savedByTeamId;
  if (clock === null || !team) return null;
  return `${type}:${eventPeriod(event.period) ?? "?"}:${clock}:${String(team).toLowerCase()}`;
}

// Public HMS embeds expose rulebook labels even when the integration feed only
// supplies IDs. Match only unambiguous sporting events in the same score snapshot.
// Raw public responses and unrelated player/contact fields are never copied.
export function enrichEventGroups(groups, metadata, detail) {
  if (!metadata || !Array.isArray(metadata.GameEvents)
    || Number(metadata.HomeTeamGoals) !== Number(detail?.HomeTeamGoals)
    || Number(metadata.AwayTeamGoals) !== Number(detail?.AwayTeamGoals)) return;
  for (const [group, type] of [["goals", "goal"], ["penalties", "penalty"], ["saves", "save"]]) {
    const primary = groups[group].events;
    const additional = metadata.GameEvents.filter((event) => event.entity === entities[type]);
    for (let i = 0; i < primary.length; i++) {
      const event = primary[i];
      const matchKey = fingerprint(event, type);
      if (!matchKey || primary.filter((item) => fingerprint(item, type) === matchKey).length !== 1) continue;
      const matches = additional.filter((item) => fingerprint(item, type) === matchKey);
      if (matches.length !== 1) continue;
      const enriched = { ...event };
      for (const field of fields) {
        if (event[field]?.name || !matches[0][field]) continue;
        const value = matches[0][field];
        const idField = `${field[0].toLowerCase()}${field.slice(1)}Id`;
        if (event[idField] && value[idField] && String(event[idField]).toLowerCase() !== String(value[idField]).toLowerCase()) continue;
        enriched[field] = { name: clean(value.name), code: clean(value.code), [idField]: clean(value[idField]) };
      }
      primary[i] = enriched;
    }
  }
}
