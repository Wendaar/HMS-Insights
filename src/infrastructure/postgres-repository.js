import { neon } from "@neondatabase/serverless";
import { detectedRows, rowsFor } from "./analysis-rows.js";
import { detectSeasonPriklepy, SEASON_TYPES } from "../domain/season-rules.js";

const specs = {
  games: {
    conflict: ["game_id"],
    json: ["event_snapshot"],
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
    const value = spec.json.includes(column) ? (row[column] == null ? null : JSON.stringify(row[column])) : row[column];
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

const EXTENDED_INSIGHT_TYPES = [
  "BIG_WIN", "EARLY_GOAL", "MULTIPOINT_GAME", "HATTRICK", "BIG_SAVES",
  "TEAM_GOAL_MILESTONE", "COMEBACK_WIN",
  ...Object.values(SEASON_TYPES),
];

export async function ensureExtendedInsightsSchema(options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  await sql.query("alter table games add column if not exists score_was_overridden boolean not null default false");
  const constraints = await sql.query(
    "select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'detected_priklepy'::regclass and conname = 'detected_priklepy_type_check'",
  );
  if (!String(constraints[0]?.definition ?? "").includes("SEASON_GOAL_MILESTONE")) {
    await sql.query("alter table detected_priklepy drop constraint if exists detected_priklepy_type_check");
    const allowed = EXTENDED_INSIGHT_TYPES.map((type) => `'${type}'`).join(", ");
    await sql.query(`alter table detected_priklepy add constraint detected_priklepy_type_check check (type in (${allowed}))`);
  }
  await sql.query("create index if not exists player_game_stats_history_idx on player_game_stats (player_id, game_id)");
  await sql.query("create index if not exists team_game_stats_history_idx on team_game_stats (team_id, game_id)");
  return true;
}

function isoTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value ?? "") : date.toISOString();
}

export async function refreshSeasonPriklepyPostgres(game, options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const values = [game.organizationId, game.seasonId];
  const [playerRows, teamRows] = await Promise.all([
    sql.query(`select g.game_id, g.organization_id, g.competition_id, g.season_id, g.group_id, g.started_at,
      p.player_id, p.team_id, p.player_name, p.goals, p.assists
      from games g join player_game_stats p on p.game_id = g.game_id
      where g.organization_id = $1::uuid and g.season_id = $2::uuid
        and not coalesce(g.score_was_overridden, false)
      order by g.started_at, g.game_id`, values),
    sql.query(`select g.game_id, g.organization_id, g.competition_id, g.season_id, g.group_id, g.started_at,
      t.team_id, t.team_name, t.result
      from games g join team_game_stats t on t.game_id = g.game_id
      where g.organization_id = $1::uuid and g.season_id = $2::uuid
      order by g.started_at, g.game_id`, values),
  ]);
  const common = (row) => ({
    gameId: row.game_id,
    organizationId: row.organization_id,
    competitionId: row.competition_id,
    seasonId: row.season_id,
    groupId: row.group_id,
    startedAt: isoTimestamp(row.started_at),
  });
  const priklepy = detectSeasonPriklepy({
    playerRows: playerRows.map((row) => ({
      ...common(row), playerId: row.player_id, teamId: row.team_id, playerName: row.player_name,
      goals: Number(row.goals), assists: Number(row.assists),
    })),
    teamRows: teamRows.map((row) => ({
      ...common(row), teamId: row.team_id, teamName: row.team_name, result: row.result,
    })),
  });
  const rows = detectedRows(priklepy);
  const upsert = buildUpsert("detected_priklepy", rows);
  if (upsert) await sql.query(upsert.text, upsert.values);
  const types = Object.values(SEASON_TYPES);
  const ids = rows.map((row) => row.priklep_id);
  if (ids.length) {
    await sql.query(`delete from detected_priklepy
      where organization_id = $1::uuid and season_id = $2::uuid and type = any($3::text[])
        and not (priklep_id = any($4::text[]))`, [...values, types, ids]);
  } else {
    await sql.query(`delete from detected_priklepy
      where organization_id = $1::uuid and season_id = $2::uuid and type = any($3::text[])`, [...values, types]);
  }
  return priklepy;
}

export async function persistAnalysisPostgres(analysis, options = {}) {
  const rows = rowsFor(analysis);
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  if (options.ensureSchema !== false) {
    await ensureEventSnapshotSchema({ sql });
    await ensureExtendedInsightsSchema({ ...options, sql });
  }
  // A corrected finished game is a full snapshot. Removing the previous snapshot
  // prevents stale players or achievements from surviving a game.updated event.
  const queries = [
    // Serialize replacements of the same game, including its first import.
    sql.query("select pg_advisory_xact_lock(hashtextextended(lower($1::text), 0))", [analysis.game.gameId]),
    sql.query("delete from games where game_id = $1", [analysis.game.gameId]),
  ];
  for (const table of Object.keys(specs)) {
    const query = buildUpsert(table, rows[table]);
    if (query) queries.push(sql.query(query.text, query.values));
  }
  await sql.transaction(queries);
  if (options.refreshSeasonInsights !== false) {
    await refreshSeasonPriklepyPostgres(analysis.game, { ...options, sql });
  }
  return rows;
}

// Follow the existing import-time schema upgrade pattern. Public readers never
// mutate schema, and to_jsonb(g) also works before this nullable column exists.
export async function ensureEventSnapshotSchema(options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const columns = await sql.query("select data_type from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'event_snapshot'");
  if (columns[0]?.data_type === "jsonb") return false;
  await sql.query("alter table games add column if not exists event_snapshot jsonb");
  return true;
}

// One statement observes a single committed snapshot, including games with no Příklepy.
export async function loadAllStarsGames(organizationId,seasonId,from,to,options={}) {
  const sql=options.sql??createSql(options.databaseUrl??databaseUrlFromEnv(options.env));
  return sql.query(`select to_jsonb(g) as game,
    coalesce((select jsonb_agg(t) from team_game_stats t where t.game_id=g.game_id),'[]'::jsonb) as teams,
    coalesce((select jsonb_agg(p) from player_game_stats p where p.game_id=g.game_id),'[]'::jsonb) as players,
    coalesce((select jsonb_agg(k) from goalie_game_stats k where k.game_id=g.game_id),'[]'::jsonb) as goalies
    from games g where organization_id=$1::uuid and season_id=$2::uuid and played_on between $3::date and $4::date
    and status='FINISHED' order by played_on,game_id limit 501`,[organizationId,seasonId,from,to]);
}

export async function loadGameSnapshot(gameId, options = {}) {
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const rows = await sql.query(`select to_jsonb(g) as game,
    coalesce((select jsonb_agg(t) from team_game_stats t where t.game_id = g.game_id), '[]'::jsonb) as teams,
    coalesce((select jsonb_agg(p) from player_game_stats p where p.game_id = g.game_id), '[]'::jsonb) as players,
    coalesce((select jsonb_agg(k) from goalie_game_stats k where k.game_id = g.game_id), '[]'::jsonb) as goalies,
    coalesce((select jsonb_agg(d) from detected_priklepy d where d.game_id = g.game_id), '[]'::jsonb) as priklepy
    from games g where g.game_id = $1::uuid`, [gameId]);
  return rows[0] ?? null;
}

export async function loadPlayerSeasonRecords(gameId,role,options={}) {
  const sql=options.sql??createSql(options.databaseUrl??databaseUrlFromEnv(options.env));
  const keeper=role==='goalie';
  // Fixed identifiers selected by a server-side role, never user SQL. Scope is
  // the game's season/group; current local date excludes future scheduled games.
  return sql.query(`with scope as (select organization_id,season_id,group_id from games where game_id=$1::uuid)
    select p.player_id::text as "PlayerId", max(p.player_name) as "FirstName", '' as "LastName",
      count(distinct p.game_id)::int as "GP",
      ${keeper?'sum(p.saves)::int as "Svs",sum(p.goals_against)::int as "GA"':'sum(p.goals)::int as "G",sum(p.assists)::int as "A",sum(p.pim)::numeric as "PIM"'}
    from ${keeper?'goalie_game_stats':'player_game_stats'} p join games g on g.game_id=p.game_id join scope s on g.organization_id=s.organization_id and g.season_id=s.season_id and g.group_id=s.group_id
    where g.status='FINISHED' and g.played_on <= (now() at time zone 'Europe/Prague')::date group by p.player_id`,[gameId]);
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
    gameReportUrl: `/game-center/${row.game_id}/public`,
    gameDetailUrl: `https://prod.hms.wootera.net/embed/game?gameId=${row.game_id}&lang=cs`,
  };
}

export async function loadPublicFeed(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 200), 1), 500);
  const sql = options.sql ?? createSql(options.databaseUrl ?? databaseUrlFromEnv(options.env));
  const result = await sql.query(
    `select * from public_priklepy_feed${options.organizationId?" where game_id in (select game_id from games where organization_id=$2::uuid)":""} order by played_on desc, importance desc, priklep_id limit $1`,
    options.organizationId?[limit,options.organizationId]:[limit],
  );
  return result.map(publicFeedItem);
}

function feedWhere(options, values) {
  const clauses = [];
  if(options.organizationId){values.push(options.organizationId);clauses.push(`game_id in (select game_id from games where organization_id=$${values.length}::uuid)`);}
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
    from public_priklepy_feed${options.organizationId?" where game_id in (select game_id from games where organization_id=$1::uuid)":""}`,options.organizationId?[options.organizationId]:[]);
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
  const filters = [];
  let orgParameter;
  if(options.organizationId){values.push(options.organizationId);orgParameter=values.length;filters.push(`game_id in (select game_id from games where organization_id=$${orgParameter}::uuid)`);}
  if (options.teamId) {
    values.push(String(options.teamId));
    filters.push(`team_id = $${values.length}::uuid`);
  }
  if (options.group) {
    values.push(String(options.group));
    filters.push(`group_name = $${values.length}`);
  }
  if (options.team) {
    values.push(String(options.team));
    filters.push(`team_name = $${values.length}`);
  }
  if (String(options.query ?? "").trim()) {
    const escaped = String(options.query).trim().replace(/[\\%_]/g, "\\$&");
    values.push(`%${escaped}%`);
    filters.push(`concat_ws(' ', title, body, player_name, team_name, home_team_name, away_team_name) ilike $${values.length} escape '\\'`);
  }
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
      from public_priklepy_feed${orgParameter?` where game_id in (select game_id from games where organization_id=$${orgParameter}::uuid)`:""}
    )
    ${filters.length ? `and ${filters.join(" and ")}` : ""}
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

// Bounded, organization-scoped Studio reader. Reuses the existing public feed projection.
export async function loadStudioPage(options = {}) {
  const sql = options.sql ?? createSql(databaseUrlFromEnv(options.env));
  const values = [options.organizationId, options.from, options.to, options.limit + 1, options.offset];
  const insights = options.section === 'insights';
  const rows = await sql.query(insights
    ? `select f.* from public_priklepy_feed f join games g on g.game_id=f.game_id
       where g.organization_id=$1::uuid and g.played_on between $2::date and $3::date
       order by f.played_on desc, f.importance desc, f.priklep_id limit $4 offset $5`
    : `select game_id,played_on,status,home_team_name,away_team_name from games
       where organization_id=$1::uuid and played_on between $2::date and $3::date
       order by played_on,game_id limit $4 offset $5`, values);
  return { items:rows.slice(0,options.limit).map(insights ? publicFeedItem : r=>({gameId:r.game_id,playedOn:dateOnly(r.played_on),status:r.status,home:{name:r.home_team_name},away:{name:r.away_team_name}})),
    hasMore:rows.length>options.limit,offset:options.offset,source:'imported-snapshot',from:options.from,to:options.to };
}

// One bounded metadata query for the selected HMS page; no per-game snapshots.
export async function loadControlLeagues(organizationId,options={}) {
  const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
  return sql.query(`select distinct organization_id,season_id,competition_name,season_name
    from games where organization_id=$1::uuid and season_id is not null
    and competition_name is not null and season_name is not null
    order by competition_name,season_name desc limit 300`,[organizationId]);
}
export async function loadControlSeason(seasonId,options={}) {
 const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
 return sql.query('select distinct organization_id from games where season_id=$1::uuid limit 2',[seasonId]);
}
export async function loadControlGames(organizationId,seasonId,options={}) {
  const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
  return sql.query(`select game_id,season_id,organization_id,played_on,home_team_name,away_team_name
    from games where organization_id=$1::uuid and season_id=$2::uuid
    order by played_on desc,game_id limit 100`,[organizationId,seasonId]);
}
export async function loadAvailableGameReports(gameIds,seasonId,options={}) {
  if(!gameIds.length)return [];
  const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
  const rows=await sql.query('select game_id from games where season_id=$1::uuid and game_id=any($2::uuid[])',[seasonId,gameIds.slice(0,20)]);
  return rows.map(row=>row.game_id);
}

export async function loadStudioGameLabels(gameIds,organizationId,options={}) {
  if(!gameIds.length)return [];
  const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
  return sql.query(`select g.game_id, g.home_team_name, g.away_team_name,
    h.team_logo_url as home_logo_url, h.team_logo_template_url as home_logo_template_url,
    a.team_logo_url as away_logo_url, a.team_logo_template_url as away_logo_template_url
    from games g
    left join team_game_stats h on h.game_id=g.game_id and h.side='HOME'
    left join team_game_stats a on a.game_id=g.game_id and a.side='AWAY'
    where g.organization_id=$1::uuid and g.game_id=any($2::uuid[])`,[organizationId,gameIds.slice(0,20)]);
}

// Reuses the existing feed, but resolves the subject's team through this game's
// player/goalie row, never through an unrelated current-season registration.
export async function loadStudioInsights(options={}) {
  const sql=options.sql??createSql(databaseUrlFromEnv(options.env));
  const values=[options.organizationId,options.today],clauses=['g.organization_id=$1::uuid',"g.status='FINISHED'",'g.played_on <= $2::date'];
  const query=String(options.query??'').trim().slice(0,160);
  if(query){
    const accented='áčďéěíňóřšťúůýžľĺŕôä',plain='acdeeinorstuuyzllroa';
    const term=[...query.normalize('NFC').toLowerCase()].map(c=>accented.includes(c)?plain[accented.indexOf(c)]:c).join('').replace(/[\\%_]/g,'\\$&');
    values.push('%'+term+'%');
    clauses.push(`translate(lower(concat_ws(' ',f.title,f.body,f.player_name,ts.team_name,g.home_team_name,g.away_team_name,g.competition_name,g.group_name)),
      'áčďéěíňóřšťúůýžľĺŕôä','acdeeinorstuuyzllroa') ilike $${values.length} escape '\\'`);
  }
  if(options.type){values.push(options.type);clauses.push(`f.type=$${values.length}`);}
  values.push(options.limit+1,options.offset);
  const rows=await sql.query(`select f.*,coalesce(ps.team_id,gs.team_id,f.team_id) as subject_team_id,
    ts.team_name as subject_team_name, ts.team_logo_url as subject_team_logo_url,
    ts.team_logo_template_url as subject_team_logo_template_url,
    coalesce(to_jsonb(ps)->>'player_image_template_url',to_jsonb(gs)->>'player_image_template_url') as profile_template_url
    from public_priklepy_feed f join games g on g.game_id=f.game_id
    left join player_game_stats ps on ps.game_id=f.game_id and ps.player_id=f.player_id
    left join goalie_game_stats gs on gs.game_id=f.game_id and gs.player_id=f.player_id
    left join team_game_stats ts on ts.game_id=f.game_id and ts.team_id=coalesce(ps.team_id,gs.team_id,f.team_id)
    where ${clauses.join(' and ')} order by g.played_on desc,f.importance desc,f.priklep_id
    limit $${values.length-1} offset $${values.length}`,values);
  return {items:rows.slice(0,options.limit).map(row=>({...publicFeedItem(row),playerId:row.player_id,teamId:row.subject_team_id,
    team:row.subject_team_name??'',teamLogoUrl:row.subject_team_logo_template_url??row.subject_team_logo_url??null,
    playerImageUrl:row.profile_template_url??row.player_image_url??null})),hasMore:rows.length>options.limit,offset:options.offset,source:'imported-snapshot'};
}
