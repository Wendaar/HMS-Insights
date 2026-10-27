import { capturePregameRankings } from "../app/pregame-rankings.js";

function authorized(request, env) {
  const secret = env.CRON_SECRET?.trim();
  const header = request.headers?.authorization ?? request.headers?.Authorization;
  return Boolean(secret && secret.length >= 16 && header === `Bearer ${secret}`);
}

export function createPregameRankingsHandler(options = {}) {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const env = options.env ?? process.env;
    if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
    if (!authorized(request, env)) return response.status(401).json({ error: "Unauthorized" });
    try {
      const result = await (options.capture ?? capturePregameRankings)("PHM", { ...options, env });
      return response.status(200).json(result);
    } catch {
      return response.status(503).json({ error: "Pregame rankings unavailable" });
    }
  };
}
