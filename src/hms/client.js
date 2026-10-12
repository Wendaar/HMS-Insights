function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Chybí serverová konfigurace ${name}.`);
  return value;
}

function endpoint(template, gameId) {
  if (!template.includes("{gameId}")) {
    throw new Error("HMS endpoint musí obsahovat zástupný text {gameId}.");
  }
  return template.replaceAll("{gameId}", encodeURIComponent(gameId));
}

async function getJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HMS API vrátilo ${response.status} pro ${new URL(url).pathname}.`);
  }
  return response.json();
}

export function hmsConfigFromEnv(env = process.env) {
  return {
    token: requiredEnv(env, "HMS_API_TOKEN"),
    gameEventsUrlTemplate: requiredEnv(env, "HMS_GAME_EVENTS_URL_TEMPLATE"),
    lineupUrlTemplate: requiredEnv(env, "HMS_LINEUP_URL_TEMPLATE"),
  };
}

export async function fetchFinishedGameResponses(gameId, options = {}) {
  const config = options.config ?? hmsConfigFromEnv(options.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  return Promise.all([
    getJson(endpoint(config.gameEventsUrlTemplate, gameId), config.token, fetchImpl),
    getJson(endpoint(config.lineupUrlTemplate, gameId), config.token, fetchImpl),
  ]);
}

export { endpoint };
