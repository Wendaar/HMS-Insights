import { neon } from "@neondatabase/serverless";
import { rowsFor } from "./analysis-rows.js";

const specs = {
  games: {
    conflict: ["game_id"],
    json: [],
  },
  player_game_stats: {
    conflict: ["game_id", "player_id"],
    json: [],
  },
  goalie_game_stats: {
    conflict: ["game_id", "player_id"],
    json: [],
  },
  team_game_stats: {
    conflict: ["game_id", "team_id"],
    json: [],
  },
  detected_priklepy: {
    conflict: ["priklep_id"],
    json: ["facts"],
  },
};

function databaseUrlFromEnv(env = process.env) {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error("Chybí serverová konfigurace DATABASE_URL.");
  return value;
}

function buildUpsert(table, rows) {
  const spec = specs[table];
  if (!spec) throw new Error(`Nepovolená tabulka: ${table}`);
  if (!rows.length) return null;

  const columns = Object.keys(rows[0]);
  const values = [];
  const tuples = rows.map((row) => `(${columns.map((column) => {
    values.push(spec.json.includes(column) ? JSON.stringify(row[column] ?? {}) : row[column]);
    return `$${values.length}${spec.json.includes(column) ? "::jsonb" : ""}`;
  }).join(", ")})`);
  const updates = columns
    .filter((column) => !spec.conflict.includes(column))
    .map((column) => `${column} = excluded.${column}`);

  return {
    text: `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")} on conflict (${spec.conflict.join(", ")}) do update set ${updates.join(", ")}`,
    values,
  };
}

function createSql(databaseUrl) {
  return neon(databaseUrl);
}

export async function persistAnalysisPostgres(analysis, options = {}) {
  const rows = rowsFor(analysis);
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  // A corrected finished game is a full snapshot. Removing the previous snapshot
  // prevents stale players or achievements from surviving a game.updated event.
  await sql.query("delete from games where game_id = $1", [analysis.game.gameId]);
  for (const table of Object.keys(specs)) {
    const query = buildUpsert(table, rows[table]);
    if (query) await sql.query(query.text, query.values);
  }
  return rows;
}

function publicFeedItem(row) {
  return {
    id: row.priklep_id,
    type: row.type,
    importance: row.importance,
    title: row.title,
    text: row.body,
    facts: row.facts ?? {},
    gameId: row.game_id,
    date: row.played_on,
    competition: row.competition_name,
    season: row.season_name,
    group: row.group_name,
    groupColor: row.group_color,
    groupLogoUrl: row.group_logo_url,
    phase: row.phase_name,
    venue: row.venue_name ?? "Neuvedený stadion",
    venueLogoUrl: row.venue_logo_url,
    sponsor: row.sponsor_name ?? "Bez partnera",
    sponsorLogoUrl: row.sponsor_logo_url,
    homeTeam: row.home_team_name,
    awayTeam: row.away_team_name,
    homeScore: row.home_score,
    awayScore: row.away_score,
    team: row.team_name ?? "",
    player: row.player_name ?? "",
    playerImageUrl: row.player_image_url,
    teamLogoUrl: row.team_logo_url,
    teamColor: row.team_color ?? row.group_color ?? "#8fe7ff",
    source: "HMS",
    gameDetailUrl: `https://prod.hms.wootera.net/embed/game?gameId=${row.game_id}&lang=cs`,
  };
}

export async function loadPublicFeed(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 200), 1), 500);
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const result = await sql.query(
    "select * from public_priklepy_feed order by played_on desc, importance desc, priklep_id limit $1",
    [limit],
  );
  return result.map(publicFeedItem);
}

export { buildUpsert, databaseUrlFromEnv, publicFeedItem };
