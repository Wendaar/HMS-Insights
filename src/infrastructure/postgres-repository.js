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
    const value = spec.json.includes(column) ? JSON.stringify(row[column] ?? {}) : row[column];
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Neplatná číselná hodnota pro ${table}.${column}.`);
    }
    values.push(value);
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

function dateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ""));
  return match?.[1] ?? null;
}

export async function ensurePenaltyMinutesSchema(options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const columns = await sql.query(
    "select data_type from information_schema.columns where table_schema = 'public' and table_name = 'player_game_stats' and column_name = 'pim'",
  );
  if (columns[0]?.data_type === "numeric") return false;
  await sql.query("alter table player_game_stats alter column pim type numeric(10,6) using pim::numeric");
  return true;
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
    date: dateOnly(row.played_on),
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

function feedWhere(options, values) {
  const clauses = [];
  const exact = [
    ["season", "season_name"],
    ["group", "group_name"],
    ["phase", "phase_name"],
  ];
  for (const [key, column] of exact) {
    if (!options[key]) continue;
    values.push(String(options[key]));
    clauses.push(`${column} = $${values.length}`);
  }
  if (options.team) {
    values.push(String(options.team));
    clauses.push(`(home_team_name = $${values.length} or away_team_name = $${values.length})`);
  }
  if (options.venue) {
    if (options.venue === "Neuvedený stadion") clauses.push("venue_name is null");
    else {
      values.push(String(options.venue));
      clauses.push(`venue_name = $${values.length}`);
    }
  }
  if (options.sponsor) {
    if (options.sponsor === "Bez partnera") clauses.push("sponsor_name is null");
    else {
      values.push(String(options.sponsor));
      clauses.push(`sponsor_name = $${values.length}`);
    }
  }
  if (String(options.query ?? "").trim()) {
    const escaped = String(options.query).trim().replace(/[\\%_]/g, "\\$&");
    values.push(`%${escaped}%`);
    clauses.push(`concat_ws(' ', title, body, player_name, team_name, home_team_name, away_team_name) ilike $${values.length} escape '\\'`);
  }
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}

export async function loadPublicFeedPage(options = {}) {
  const requestedLimit = Number(options.limit ?? 40);
  const requestedOffset = Number(options.offset ?? 0);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 40;
  const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const filterValues = [];
  const where = feedWhere(options, filterValues);
  const countRows = await sql.query(`select count(*)::integer as total from public_priklepy_feed${where}`, filterValues);
  const pageValues = [...filterValues, limit, offset];
  const rows = await sql.query(
    `select * from public_priklepy_feed${where} order by played_on desc, importance desc, priklep_id limit $${filterValues.length + 1} offset $${filterValues.length + 2}`,
    pageValues,
  );
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map(publicFeedItem),
    total,
    offset,
    hasMore: offset + rows.length < total,
  };
}

export async function loadPublicFeedOptions(options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const rows = await sql.query(`select distinct
    season_name, group_name, phase_name, venue_name, sponsor_name, home_team_name, away_team_name
    from public_priklepy_feed`);
  const unique = (values, fallback = null) => [...new Set(values.map((value) => value ?? fallback).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "cs"));
  return {
    seasons: unique(rows.map((row) => row.season_name)),
    groups: unique(rows.map((row) => row.group_name)),
    teams: unique(rows.flatMap((row) => [row.home_team_name, row.away_team_name])),
    phases: unique(rows.map((row) => row.phase_name)),
    venues: unique(rows.map((row) => row.venue_name), "Neuvedený stadion"),
    sponsors: unique(rows.map((row) => row.sponsor_name), "Bez partnera"),
  };
}

export async function loadPublicSelection(options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const requestedLimit = Number(options.limit ?? 30);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 60) : 30;
  const requestedDays = Number(options.days ?? 14);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 90) : 14;
  const requestedPerGame = Number(options.perGame ?? 3);
  const perGame = Number.isFinite(requestedPerGame) ? Math.min(Math.max(Math.trunc(requestedPerGame), 1), 5) : 3;
  const values = [];
  const teamClause = options.teamId
    ? (() => {
        values.push(String(options.teamId));
        return `and team_id = $${values.length}::uuid`;
      })()
    : "";
  values.push(days);
  const daysParameter = values.length;
  values.push(perGame);
  const perGameParameter = values.length;
  values.push(limit);
  const limitParameter = values.length;

  const rows = await sql.query(`with recent as (
    select *, row_number() over (
      partition by game_id, case
        when player_id is not null then 'player:' || player_id::text
        when team_id is not null then 'team:' || team_id::text
        else priklep_id
      end
      order by importance desc, priklep_id
    ) as subject_rank
    from public_priklepy_feed
    where played_on >= (
      select max(played_on) - ($${daysParameter}::integer - 1) * interval '1 day'
      from public_priklepy_feed
    )
    ${teamClause}
  ), ranked as (
    select *, row_number() over (
      partition by game_id order by importance desc, priklep_id
    ) as game_rank
    from recent
    where subject_rank = 1
  )
  select * from ranked
  where game_rank <= $${perGameParameter}
  order by played_on desc, importance desc, priklep_id
  limit $${limitParameter}`, values);

  const items = rows.map(publicFeedItem);
  return { items, total: items.length, hasMore: false, mode: "selection" };
}

export { buildUpsert, databaseUrlFromEnv, dateOnly, feedWhere, publicFeedItem };
