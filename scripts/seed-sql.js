import { sampleAnalysis } from "../src/app/sample.js";
import { rowsFor } from "../src/infrastructure/supabase-repository.js";

function literal(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, rows, conflictColumns, updateColumns) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const values = rows.map((row) => `(${columns.map((column) => literal(row[column])).join(", ")})`).join(",\n  ");
  const updates = updateColumns.map((column) => `${column} = excluded.${column}`).join(", ");
  return `insert into ${table} (${columns.join(", ")}) values\n  ${values}\non conflict (${conflictColumns.join(", ")}) do update set ${updates};`;
}

const rows = rowsFor(sampleAnalysis);
const statements = [
  "begin;",
  insert("games", rows.games, ["game_id"], ["organization_id", "competition_id", "season_id", "group_id", "phase_id", "status", "played_on", "started_at", "home_team_id", "away_team_id", "home_team_name", "away_team_name", "home_score", "away_score", "updated_at"]),
  insert("player_game_stats", rows.player_game_stats, ["game_id", "player_id"], ["team_id", "player_name", "goals", "assists", "pim"]),
  insert("goalie_game_stats", rows.goalie_game_stats, ["game_id", "player_id"], ["team_id", "player_name", "saves", "goals_against"]),
  insert("team_game_stats", rows.team_game_stats, ["game_id", "team_id"], ["team_name", "side", "goals", "goals_against", "score_difference", "lineup_size", "result"]),
  insert("detected_priklepy", rows.detected_priklepy, ["priklep_id"], ["organization_id", "competition_id", "season_id", "group_id", "game_id", "type", "player_id", "team_id", "importance", "title", "body", "facts"]),
  "commit;",
  "",
  "select 'games' as entity, count(*) as rows from games",
  "union all select 'player_game_stats', count(*) from player_game_stats",
  "union all select 'goalie_game_stats', count(*) from goalie_game_stats",
  "union all select 'team_game_stats', count(*) from team_game_stats",
  "union all select 'detected_priklepy', count(*) from detected_priklepy",
  "order by entity;",
];

console.log(statements.filter(Boolean).join("\n\n"));
