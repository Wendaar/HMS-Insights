import { backfillFinishedGamesPage } from "../../src/app/backfill-finished-games.js";
import { ensurePenaltyMinutesSchema } from "../../src/infrastructure/postgres-repository.js";
import { hasBearerSecret } from "../../src/security/bearer-secret.js";

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!hasBearerSecret(request, process.env.HMS_WEBHOOK_SECRET)) {
    return response.status(401).json({ error: "Nesprávný secret." });
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  const from = String(body?.from ?? "");
  const seasonId = String(body?.seasonId ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return response.status(400).json({ error: "Datum od musí být ve formátu YYYY-MM-DD." });
  }
  if (!/^[0-9a-f-]{36}$/i.test(seasonId)) {
    return response.status(400).json({ error: "Neplatné ID sezony." });
  }

  try {
    await ensurePenaltyMinutesSchema();
    const result = await backfillFinishedGamesPage({
      from,
      seasonId,
      skip: Math.max(Number(body?.skip ?? 0), 0),
      // One game per invocation keeps the HMS fetch + database snapshot well
      // below Vercel's function duration limit. The browser paces requests to
      // remain below the HMS API rate limit.
      limit: 1,
      intervalMs: 0,
    });
    return response.status(200).json(result);
  } catch (error) {
    console.error(error);
    return response.status(422).json({ error: error.message });
  }
}
