import { processFinishedGame } from "../../src/app/process-finished-game.js";
import { hasBearerSecret } from "../../src/security/bearer-secret.js";
import { ensurePenaltyMinutesSchema } from "../../src/infrastructure/postgres-repository.js";

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!hasBearerSecret(request, process.env.HMS_WEBHOOK_SECRET)) {
    return response.status(401).json({ error: "Nesprávný secret." });
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  try {
    await ensurePenaltyMinutesSchema();
    const result = await processFinishedGame(body?.gameId);
    return response.status(200).json({ imported: true, ...result });
  } catch (error) {
    console.error(error);
    return response.status(422).json({ imported: false, error: error.message });
  }
}
