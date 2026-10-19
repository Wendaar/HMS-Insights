import { goalDetails, penaltyDetails } from "../domain/goal-details.js";

// Keep only sporting facts. Raw HMS payloads and contact fields never enter storage.
const id = (value) => typeof value === "string" && value ? value.toLowerCase() : null;
const name = (player) => [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim() || null;

export function eventClock(value) {
  if (value == null || value === "") return null;
  const match = /^(\d+):([0-5]\d)$/.exec(String(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function eventPeriod(value) {
  if (Number.isInteger(value) && value >= 1 && value <= 9) return value;
  const match = /^([1-9])(?:\.?\s*(?:třetina|tretina|period))?$/i.exec(String(value ?? "").trim());
  return match ? Number(match[1]) : null;
}

// Explicit empty collections are authoritative; never resurrect deleted events
// from an older embedded list in game detail.
export function selectEventGroup(response, detail, key, type) {
  if (Array.isArray(response?.[key])) return { events: response[key], available: true };
  if (Array.isArray(response?.events)) return {
    events: response.events.filter((event) => event.type?.toLowerCase() === type), available: true,
  };
  if (Array.isArray(detail?.[key])) return { events: detail[key], available: true };
  return { events: [], available: false };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function uniqueEvents(events, type) {
  const seen = new Map();
  return events.filter((event) => {
    const eventId = id(event.eventId ?? event[`gameEvent${type[0].toUpperCase()}${type.slice(1)}Id`]);
    if (!eventId) return true; // Two unattributed quick events may legitimately be identical.
    const signature = JSON.stringify(canonical(event));
    if (seen.has(eventId)) {
      if (seen.get(eventId) !== signature) throw new Error("HMS vrátilo konfliktní verze stejné události.");
      return false;
    }
    seen.set(eventId, signature);
    return true;
  });
}

export function buildEventSnapshot(game, groups, players, penaltyMinutes) {
  const player = (playerId, embedded) => ({
    id: id(playerId ?? embedded?.playerId),
    name: players.get(playerId ?? embedded?.playerId)?.playerName ?? name(embedded),
  });
  const base = (event, type, index) => ({
    id: id(event.eventId ?? event[`gameEvent${type[0].toUpperCase()}${type.slice(1)}Id`]) ?? `${type}:unidentified:${index}`,
    type, period: eventPeriod(event.period),
    clock: eventClock(event.gameTime) === null ? null : String(event.gameTime),
    clockSeconds: eventClock(event.gameTime),
  });
  const events = [
    ...groups.goals.events.filter((event) => !event.isDeleted).map((event, index) => ({
      ...base(event, "goal", index),
      teamId: id(event.scoredByTeamId ?? event.ScoredByTeam?.teamId),
      player: player(event.scoredByPlayerId, event.ScoredByPlayer),
      allowedBy: player(event.allowedByPlayerId, event.AllowedByPlayer),
      details: goalDetails(event),
      assists: [
        player(event.assistedBy1PlayerId, event.AssistedBy1Player),
        player(event.assistedBy2PlayerId, event.AssistedBy2Player),
      ].filter((p) => p.id || p.name),
    })),
    ...groups.penalties.events.filter((event) => !event.isDeleted).map((event, index) => ({
      ...base(event, "penalty", index),
      teamId: id(event.penalizedTeamId ?? event.PenalizedTeam?.teamId ?? players.get(event.penalizedPlayerId)?.teamId),
      player: player(event.penalizedPlayerId, event.PenalizedPlayer),
      penaltyMinutes: penaltyMinutes(event.duration),
      penaltyDetails: penaltyDetails(event),
    })),
    ...groups.saves.events.filter((event) => !event.isDeleted).map((event, index) => ({
      ...base(event, "save", index),
      teamId: id(event.savedByTeamId ?? event.SavedByTeam?.teamId ?? players.get(event.savedByPlayerId)?.teamId),
      player: player(event.savedByPlayerId, event.SavedByPlayer),
    })),
  ];
  return {
    // HMS gameTime uses elapsed game time (also used by existing Příklepy rules).
    // Keep period separately; never guess period boundaries from clock minutes.
    version: 1, clockBasis: "game-elapsed", events,
    collections: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.available])),
    scoreWasOverridden: game.scoreWasOverridden,
  };
}
