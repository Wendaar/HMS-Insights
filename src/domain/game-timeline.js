import { publicGoalDetails, publicReference } from "./goal-details.js";
import { applySpecialTeams, specialTeamTotals } from "./special-teams.js";
import {eventRecordedAt} from '../hms/event-snapshot.js';

const string = (value) => typeof value === "string" ? value : null;
const id = (value) => string(value)?.toLowerCase() ?? null;
const person = (value) => ({ id: id(value?.id), name: string(value?.name) });

export function buildGameTimeline(game) {
  const snapshot = game.event_snapshot;
  const empty = { available: false, coverage: "unknown", ordered: false, collections: null, unplacedEvents: 0, events: [], periodScores: [] };
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.events)) return empty;
  const events = snapshot.events.filter((event) => ["goal", "penalty", "save"].includes(event.type)).map((event) => ({
    id: string(event.id), type: event.type, teamId: id(event.teamId),
    period: Number.isInteger(event.period) && event.period > 0 && event.period <= 9 ? event.period : null,
    clock: string(event.clock),
    clockSeconds: Number.isFinite(event.clockSeconds) && event.clockSeconds >= 0 ? event.clockSeconds : null,
    recordedAt:eventRecordedAt(event),
    player: person(event.player),
    ...(event.type === "goal" ? { assists: (Array.isArray(event.assists) ? event.assists : []).map(person), allowedBy: person(event.allowedBy), details: publicGoalDetails(event.details) } : {}),
    ...(event.type === "penalty" ? { penaltyMinutes: Number.isFinite(event.penaltyMinutes) && event.penaltyMinutes >= 0 ? event.penaltyMinutes : null,
      penaltyDetails: { type: publicReference(event.penaltyDetails?.type), subtype: publicReference(event.penaltyDetails?.subtype) } } : {}),
  }));
  const goals = events.filter((event) => event.type === "goal");
  const homeId = id(game.home_team_id);
  const awayId = id(game.away_team_id);
  const side = (event) => event.teamId === homeId ? "home" : event.teamId === awayId ? "away" : null;
  const goalsAvailable = snapshot.collections?.goals === true;
  const consistent = goalsAvailable && goals.every(side)
    && goals.filter((event) => side(event) === "home").length === Number(game.home_score)
    && goals.filter((event) => side(event) === "away").length === Number(game.away_score);
  const coverage = !goalsAvailable ? "unknown" : consistent ? "matches-result" : "score-mismatch";
  const byPeriod = goals.every((event) => event.period !== null);
  const positioned = (event) => event.clockSeconds !== null
    && (byPeriod ? event.period !== null : snapshot.clockBasis === "game-elapsed");
  const uniqueGoalTimes = new Set(goals.map((event) => `${byPeriod ? event.period : "game"}:${event.clockSeconds}`)).size === goals.length;
  const clockOrdered = goalsAvailable && goals.every(positioned) && uniqueGoalTimes;
  const relevant=events.filter(e=>e.type!=='save');
  const recordingOrdered=(!clockOrdered||relevant.some(e=>!positioned(e)))&&relevant.length>0&&relevant.every(e=>e.recordedAt!==null);
  const recordingByPeriod=relevant.every(e=>e.period!==null);
  const ordered=clockOrdered&&!recordingOrdered;
  events.sort(recordingOrdered?(a,b)=>(recordingByPeriod?(a.period??Infinity)-(b.period??Infinity):0)
    || (a.recordedAt===null)-(b.recordedAt===null)
    || (a.recordedAt??'').localeCompare(b.recordedAt??'')
    || `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)
    :(a, b) => Number(positioned(b)) - Number(positioned(a))
    || (byPeriod ? (a.period ?? Infinity) - (b.period ?? Infinity) : 0)
    || (a.clockSeconds ?? Infinity) - (b.clockSeconds ?? Infinity)
    || `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  const score = { home: 0, away: 0 };
  for (const event of events) {
    if (event.type !== "goal") continue;
    if (consistent && ordered) {
      score[side(event)]++;
      event.scoreAfter = { ...score };
    } else event.scoreAfter = null;
  }
  const periodScores = consistent && goals.every((event) => event.period !== null)
    ? [...new Set(goals.map((event) => event.period))].sort((a, b) => a - b).map((period) => ({
      period, home: goals.filter((event) => event.period === period && side(event) === "home").length,
      away: goals.filter((event) => event.period === period && side(event) === "away").length,
    })) : [];
  applySpecialTeams(events, { consistent, ordered, penaltiesAvailable: snapshot.collections?.penalties === true, homeId, awayId });
  return {
    available: Object.values(snapshot.collections ?? {}).some((value) => value === true),
    collections: Object.fromEntries(["goals", "penalties", "saves"].map((key) => [key, snapshot.collections?.[key] === true])),
    unplacedEvents: events.filter((event) => event.type !== "save" && !positioned(event)&&!(recordingOrdered&&event.recordedAt)).length,
    displayOrder:recordingOrdered?'recorded-at':ordered?'game-clock':'partial',
    coverage, ordered, events, periodScores,
    specialTeams: specialTeamTotals(events, { consistent, ordered, penaltiesAvailable: snapshot.collections?.penalties === true, homeId, awayId }),
  };
}
