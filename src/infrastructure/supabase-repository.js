import { rowsFor } from "./analysis-rows.js";

function configFromEnv(env = process.env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Pro uložení nastavte SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

async function upsert(table, rows, conflict, config, fetchImpl) {
  if (!rows.length) return;
  const response = await fetchImpl(`${config.url}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase ${table}: ${response.status} ${await response.text()}`);
}

export async function persistAnalysis(analysis, options = {}) {
  const config = options.config ?? configFromEnv(options.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const rows = rowsFor(analysis);
  await upsert("games", rows.games, "game_id", config, fetchImpl);
  await upsert("player_game_stats", rows.player_game_stats, "game_id,player_id", config, fetchImpl);
  await upsert("goalie_game_stats", rows.goalie_game_stats, "game_id,player_id", config, fetchImpl);
  await upsert("team_game_stats", rows.team_game_stats, "game_id,team_id", config, fetchImpl);
  await upsert("detected_priklepy", rows.detected_priklepy, "priklep_id", config, fetchImpl);
  return rows;
}

export { configFromEnv, rowsFor };
