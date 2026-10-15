const DEFAULT_BASE_URL = "https://public-api.prod.hms.wootera.net/api/v1";

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

function apiUrl(baseUrl, path, params = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

function retryDelay(response) {
  const seconds = Number(response.headers.get("retry-after") ?? 1);
  return Math.min(Math.max(seconds, 1), 60) * 1000;
}

async function getJson(url, token, fetchImpl, attempt = 0) {
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  if (response.status === 429 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response)));
    return getJson(url, token, fetchImpl, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`HMS API vrátilo ${response.status} pro ${new URL(url).pathname}.`);
  }
  return response.json();
}

export function hmsConfigFromEnv(env = process.env) {
  return {
    token: requiredEnv(env, "HMS_API_TOKEN"),
    baseUrl: env.HMS_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

async function request(path, params, options = {}) {
  const config = options.config ?? hmsConfigFromEnv(options.env);
  return getJson(apiUrl(config.baseUrl, path, params), config.token, options.fetchImpl ?? fetch);
}

export function fetchOrganization(options = {}) {
  return request("organization", {}, options);
}

export function fetchGames(params = {}, options = {}) {
  return request("games", params, options);
}

export async function fetchFinishedGameResponses(gameId, options = {}) {
  return Promise.all([
    request("game", { gameId }, options),
    request("gameEvents", { gameId }, options),
    request("gameLineup", { gameId }, options),
  ]);
}

export { DEFAULT_BASE_URL, apiUrl, endpoint };
