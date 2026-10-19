import reference from "./zbraslav-kosti-public-summary.json" with { type: "json" };
import { ids, lineupResponse as context } from "./real-game-sanitized.js";

// Reconstructed TEST INPUT, not an original API response or a stored import.
// Goals/assists/penalties/clocks transcribed from the public HMS match log:
// https://prod.hms.wootera.net/embed/game?gameId=F6321894-98CA-11F1-8BDF-EF2495D048F3&lang=cs
// Roster IDs/names/totals captured from our public GameSummary on 2026-10-19.
// Event IDs are synthetic. Save events reproduce totals only, with no invented
// timestamps. Periods were not displayed in that source and are left unknown.
export const gameId = reference.gameId;
const roster = [...reference.players, ...reference.goalies];
const byName = new Map(roster.map((p) => [p.name, p]));
const playerId = (name) => name ? byName.get(name).id : null;
const goalie = (teamId) => reference.goalies.find((p) => p.teamId === teamId);
export const lineup = {
  gameId, Phase: context.Phase, Venue: context.Venue,
  Lineups: roster.map((p) => ({
    gameId, playerId: p.id, teamId: p.teamId, isDeleted: false,
    Player: { playerId: p.id, firstName: p.name.split(" ")[0], lastName: p.name.split(" ").slice(1).join(" ") },
    ListPosition: { isGoalie: reference.goalies.some((g) => g.id === p.id) },
  })),
};
const goals = [
  ["1:40", "Dominik Velas", "Jakub Chmel"],
  ["3:40", "Mansur Ischoev", "Adam Patočka"],
  ["5:58", "Daniel Fišer", "Lukáš Miščík", "Stanislav Veselý"],
  ["7:44", "Adam Patočka", "Mansur Ischoev"],
  ["12:02", "Adam Patočka", "Mansur Ischoev"],
  ["16:11", "Adam Patočka", "Tomáš Borovanský", "Martin Hruška"],
  ["18:37", "Adam Patočka", "David Mekleš", "Mansur Ischoev"],
  ["19:58", "Lukáš Miščík", "Vojtěch Mikoláš", "Pavel Nejdl"],
  ["26:16", "Mansur Ischoev", "Martin Bernát", "Ladislav Kolář"],
  ["27:19", "Mansur Ischoev", "Antonín Janků", "Adam Patočka"],
  ["29:55", "Michal Každan"],
  ["33:09", "Michal Orgoník", "Martin Bernát"],
  ["35:09", "Daniel Fišer", "Vojtěch Mikoláš", "Dominik Velas"],
  ["40:48", "David Mekleš", "David Polomis", "Mansur Ischoev"],
  ["42:17", "David Polomis", "Adam Patočka", "Mansur Ischoev"],
];
export const gameEvents = {
  gameId, organizationId: ids.org, status: "FINISHED", startDate: reference.playedOn, startTime: "15:45:00",
  homeTeamId: reference.home.id, awayTeamId: reference.away.id,
  HomeTeam: { teamId: reference.home.id, name: reference.home.name },
  AwayTeam: { teamId: reference.away.id, name: reference.away.name },
  HomeTeamGoals: 5, AwayTeamGoals: 10,
  GameEventGoals: goals.map(([gameTime, scorer, a1, a2], i) => {
    const teamId = byName.get(scorer).teamId;
    return { gameEventGoalId: `reconstructed-goal-${i}`, gameTime, period: null,
      scoredByPlayerId: playerId(scorer), scoredByTeamId: teamId,
      assistedBy1PlayerId: playerId(a1), assistedBy2PlayerId: playerId(a2),
      allowedByPlayerId: goalie(teamId === reference.home.id ? reference.away.id : reference.home.id).id };
  }),
  GameEventPenalties: [["24:14", "Mansur Ischoev"], ["25:46", "Jakub Káš"], ["32:16", "Daniel Fišer"], ["39:19", "Vojtěch Mikoláš"]]
    .map(([gameTime, name], i) => ({ gameEventPenaltyId: `reconstructed-penalty-${i}`, gameTime,
      penalizedPlayerId: playerId(name), penalizedTeamId: byName.get(name).teamId, duration: "00:01:45" })),
  GameEventSaves: reference.goalies.flatMap((g) => Array.from({ length: g.saves }, (_, i) => ({
    gameEventSaveId: `reconstructed-save-${g.id}-${i}`, gameTime: null,
    savedByPlayerId: g.id, savedByTeamId: g.teamId,
  }))),
};
