import { buildGameTimeline } from "./game-timeline.js";
import { buildFaceoffs, goalieStatistics } from './recorded-statistics.js';

// Public, versioned read model shared by Game Center and future media consumers.
// Accepts stored normalized rows, never raw HMS responses or environment values.
export const isGameId = (value) => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function date(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10) || null;
}

export function buildGameSummary({ game, teams = [], players = [], goalies = [], priklepy = [] }) {
  const timeline = buildGameTimeline(game);
  const team = (side) => {
    const row = teams.find((item) => item.side === side);
    const prefix = side === "HOME" ? "home" : "away";
    return {
      id: game[`${prefix}_team_id`], name: game[`${prefix}_team_name`],
      score: game[`${prefix}_score`], lineupSize: row?.lineup_size ?? null,
      color: /^#[\da-f]{6}$/i.test(row?.primary_color ?? '') ? row.primary_color : null,
      secondaryColor: /^#[\da-f]{6}$/i.test(row?.secondary_color ?? '') ? row.secondary_color : null,
    };
  };
  return {
    schemaVersion: 1,
    timeline,
    faceoffs: buildFaceoffs(game.event_snapshot),
    gameId: game.game_id,
    status: game.status,
    playedOn: date(game.played_on),
    competition: game.competition_name ?? null,
    season: game.season_name ?? null,
    group: game.group_name ?? null,
    phase: game.phase_name ?? null,
    venue: game.venue_name ?? null,
    home: team("HOME"), away: team("AWAY"),
    players: players.map((row) => ({
      id: row.player_id, teamId: row.team_id, name: row.player_name,
      goals: Number(row.goals), assists: Number(row.assists),
      points: Number(row.goals) + Number(row.assists), penaltyMinutes: Number(row.pim),
    })).sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id)),
    goalies: goalies.map((row) => ({
      id: row.player_id, teamId: row.team_id, name: row.player_name,
      ...goalieStatistics(row),
    })).sort((a, b) => b.saves - a.saves || a.id.localeCompare(b.id)),
    priklepy: priklepy.map((row) => ({
      id: row.priklep_id, type: row.type, title: row.title, text: row.body,
      importance: row.importance,
    })).sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id)),
    provenance: {
      source: "HMS", updatedAt: game.updated_at ?? null,
      score: "stored-hms-result", statistics: "recorded-events",
      eventCoverage: timeline.coverage, timelineAvailable: timeline.available,
      scoreWasOverridden: typeof game.event_snapshot?.scoreWasOverridden === "boolean"
        ? game.event_snapshot.scoreWasOverridden : null,
    },
  };
}
