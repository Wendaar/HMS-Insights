import { buildGameTimeline } from "./game-timeline.js";
import { buildFaceoffs, goalieStatistics, recordedTeamShots } from './recorded-statistics.js';
import { sportingImage,flickrAlbum } from '../../public/game-report-media.js';
import {jerseyColor} from '../../public/game-report-graphics.js';

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
  const teamShots=recordedTeamShots(timeline,game.home_team_id,game.away_team_id);
  const team = (side) => {
    const row = teams.find((item) => item.side === side);
    const prefix = side === "HOME" ? "home" : "away";
    return {
      id: game[`${prefix}_team_id`], name: game[`${prefix}_team_name`],
      score: game[`${prefix}_score`], lineupSize: row?.lineup_size ?? null,
      ...teamShots[String(game[`${prefix}_team_id`]).toLowerCase()],
      logoUrl: sportingImage(row?.team_logo_template_url) ?? sportingImage(row?.team_logo_url),
      color: /^#[\da-f]{6}$/i.test(row?.primary_color ?? '') ? row.primary_color : null,
      jerseyColor:jerseyColor(game.event_snapshot?.jerseyColors?.[prefix]),
      secondaryColor: /^#[\da-f]{6}$/i.test(row?.secondary_color ?? '') ? row.secondary_color : null,
    };
  };
  return {
    schemaVersion: 1,
    timeline,
    media: { albumUrl: flickrAlbum(game.event_snapshot?.media?.albumUrl) },
    competitionLogoUrl:sportingImage(game.event_snapshot?.branding?.competitionLogoUrl),
    phaseLogoUrl:sportingImage(game.event_snapshot?.branding?.phaseLogoUrl),
    organizationLogoUrl:sportingImage(game.event_snapshot?.branding?.organizationLogoUrl),
    groupColor: /^#[\da-f]{6}$/i.test(game.group_color ?? '') ? game.group_color : null,
    groupLogoUrl:sportingImage(game.group_logo_url),venueLogoUrl:sportingImage(game.venue_logo_url),
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
      imageUrl: sportingImage(row.player_image_template_url) ?? sportingImage(row.player_image_url),
      goals: Number(row.goals), assists: Number(row.assists),
      points: Number(row.goals) + Number(row.assists), penaltyMinutes: Number(row.pim),
    })).sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id)),
    goalies: goalies.map((row) => ({
      id: row.player_id, teamId: row.team_id, name: row.player_name,
      imageUrl: sportingImage(row.player_image_template_url) ?? sportingImage(row.player_image_url),
      ...goalieStatistics(row),
      ...(teamShots[row.team_id?.toLowerCase()]?.unassignedSaves>0?{savePercentage:null,shotsAgainst:null,statisticsBasis:'partial-recorded-events'}:{}),
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
