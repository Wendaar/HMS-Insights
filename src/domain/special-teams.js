import { isMinorPenalty, recordedSituation } from "./goal-details.js";

// A conservative subset: one active, known minor penalty, an elapsed game clock,
// and a score-consistent event log. No PP/PK percentage or opportunity denominator
// is inferred. Unsupported penalties, queued same-team overlaps or reset clocks
// disable inference; direct HMS goal labels always take precedence.
export function applySpecialTeams(events, { consistent, ordered, penaltiesAvailable, homeId, awayId }) {
  const relevant = events.filter((event) => ["goal", "penalty"].includes(event.type));
  const penalties = relevant.filter((event) => event.type === "penalty");
  let supported = consistent && ordered && penaltiesAvailable
    && relevant.every((event) => event.clockSeconds !== null && [homeId, awayId].includes(event.teamId))
    && relevant.every((event, index) => !index || event.clockSeconds >= relevant[index - 1].clockSeconds)
    && penalties.every((event) => isMinorPenalty(event) && event.penaltyMinutes > 0 && event.penaltyMinutes <= 2);
  // Queued/double-minor mechanics are not represented by this subset.
  for (let i = 0; i < penalties.length; i++) for (let j = i + 1; j < penalties.length; j++) {
    if (penalties[i].teamId === penalties[j].teamId
      && penalties[j].clockSeconds < penalties[i].clockSeconds + penalties[i].penaltyMinutes * 60) supported = false;
  }
  const penaltyTimes = new Set(penalties.map((event) => event.clockSeconds));
  if (relevant.some((event) => event.type === "goal" && penaltyTimes.has(event.clockSeconds))) supported = false;
  let active = [];
  for (const event of relevant) {
    active = active.filter((penalty) => penalty.end > event.clockSeconds);
    if (event.type === "penalty") {
      active.push({ id: event.id, teamId: event.teamId, end: event.clockSeconds + event.penaltyMinutes * 60 });
      continue;
    }
    const recorded = recordedSituation(event);
    const canDerive = supported && active.length === 1 && !penaltyTimes.has(event.clockSeconds)
      && !/shootout|penalty shot|trestn[ée] střílen/i.test(event.details?.goalSubtype?.name ?? "");
    const candidate = canDerive ? active[0].teamId === event.teamId ? "SH" : "PP" : null;
    event.situation = recorded.source === "hms" ? recorded
      : candidate ? { code: candidate, source: "penalty-model", label: candidate === "PP" ? "Přesilovkový gól" : "Gól v oslabení" }
        : recorded;
    if (candidate === "PP" && ["PP", "UNKNOWN"].includes(recorded.code)) active = [];
    if (candidate && recorded.source === "hms" && recorded.code !== candidate) supported = false;
  }
}
