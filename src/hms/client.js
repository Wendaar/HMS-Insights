const DEFAULT_BASE_URL = "https://public-api.prod.hms.wootera.net/api/v1";
export class HmsRequestError extends Error {
  constructor(status,path,retryAfter){super(`HMS API vrátilo ${status} pro ${path}.`);this.name='HmsRequestError';this.status=status;
    this.retryAfter=Number.isFinite(Number(retryAfter))?Math.min(300,Math.max(1,Math.ceil(Number(retryAfter)))):30;}
}

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

async function getJson(url, token, fetchImpl, attempt = 0, config = {}) {
  const response = await fetchImpl(url, {
    signal: config.signal && config.timeoutMs ? AbortSignal.any([config.signal, AbortSignal.timeout(config.timeoutMs)]) : config.signal ?? (config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined),
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  if (response.status === 429 && attempt < (config.retries ?? 3)) {
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response)));
    return getJson(url, token, fetchImpl, attempt + 1, config);
  }
  if (!response.ok) {
    throw new HmsRequestError(response.status,new URL(url).pathname,response.headers.get('retry-after')??30);
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
  return getJson(apiUrl(config.baseUrl, path, params), config.token, options.fetchImpl ?? fetch, 0, config);
}

export function fetchOrganization(options = {}) {
  return request("organization", {}, options);
}

export function fetchGameDetail(gameId, options = {}) {
  return request("game", {gameId}, options);
}
export function fetchGameEvents(gameId, options = {}) {return request('gameEvents',{gameId},options);}
export function fetchGameLineup(gameId, options = {}) {return request('gameLineup',{gameId},options);}

export function fetchGames(params = {}, options = {}) {
  return request("games", params, options);
}

export function fetchTeams(options = {}) {
  return request('teams', {}, options);
}

export async function fetchGameResponses(gameId, options = {}) {
  return Promise.all([
    request("game", { gameId }, options),
    request("gameEvents", { gameId }, options),
    request("gameLineup", { gameId }, options),
    fetchPublicGameMetadata(gameId, options),
  ]);
}

export async function fetchPublicGameMetadata(gameId, options = {}) {
  try {
    const url = new URL("https://api.prod.hms.wootera.net/public/game");
    url.searchParams.set("gameId", gameId);
    // Deliberately no Authorization header: never send the integration token to
    // a different service. Optional labels must not break core game ingestion.
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.GameEvents) ? data : null;
  } catch { return null; }
}

export { DEFAULT_BASE_URL, apiUrl, endpoint };

// Backward-compatible import path; transport itself supports any game state.
export const fetchFinishedGameResponses = fetchGameResponses;
