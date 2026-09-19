function configFromEnv(env = process.env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Pro uložení nastavte SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

function rowsFor(analysis) {
  const { game, priklepy } = analysis;
  const home = game.teamStats.find((item) => item.side === "HOME");
  const away = game.teamStats.find((item) => item.side === "AWAY");
  return {
    games: [{
      game_id: game.gameId,
      organization_id: game.organizationId,
      competition_id: game.competitionId,
      season_id: game.seasonId,
      group_id: game.groupId,
      phase_id: game.phaseId,
      status: game.status,
      played_on: game.playedOn,
      started_at: game.startedAt,
      home_team_id: game.homeTeamId,
      away_team_id: game.awayTeamId,
      home_team_name: home.teamName,
      away_team_name: away.teamName,
      home_score: game.homeScore,
      away_score: game.awayScore,
      group_color: game.groupColor,
      group_logo_url: game.groupLogoTemplateUrl,
      venue_id: game.venueId,
      venue_name: game.venueName,
      venue_logo_url: game.venueLogoTemplateUrl,
      updated_at: new Date().toISOString(),
    }],
    player_game_stats: game.playerStats.map((item) => ({
      game_id: game.gameId,
      player_id: item.playerId,
      team_id: item.teamId,
      player_name: item.playerName,
      goals: item.goals,
      assists: item.assists,
      pim: item.pim,
      player_image_url: item.playerImageUrl,
      player_image_template_url: item.playerImageTemplateUrl,
    })),
    goalie_game_stats: game.goalieStats.map((item) => ({
      game_id: game.gameId,
      player_id: item.playerId,
      team_id: item.teamId,
      player_name: item.playerName,
      saves: item.saves,
      goals_against: item.goalsAgainst,
      player_image_url: item.playerImageUrl,
      player_image_template_url: game.players.find((player) => player.playerId === item.playerId)?.playerImageTemplateUrl ?? null,
    })),
    team_game_stats: game.teamStats.map((item) => ({
      game_id: game.gameId,
      team_id: item.teamId,
      team_name: item.teamName,
      side: item.side,
      goals: item.goals,
      goals_against: item.goalsAgainst,
      score_difference: item.scoreDifference,
      lineup_size: item.lineupSize,
      result: item.result,
      team_logo_url: item.logoUrl,
      team_logo_template_url: item.logoTemplateUrl,
      primary_color: item.primaryColor,
      secondary_color: item.secondaryColor,
    })),
    detected_priklepy: priklepy.map((item) => ({
      priklep_id: item.id,
      organization_id: item.organizationId,
      competition_id: item.competitionId,
      season_id: item.seasonId,
      group_id: item.groupId,
      game_id: item.gameId,
      type: item.type,
      player_id: item.playerId,
      team_id: item.teamId,
      importance: item.importance,
      title: item.title,
      body: item.text,
      facts: item.facts,
    })),
  };
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
