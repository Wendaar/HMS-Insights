import { processFinishedGame } from "../../src/app/process-finished-game.js";
import { hasBearerSecret } from "../../src/security/bearer-secret.js";
import { ensurePenaltyMinutesSchema } from "../../src/infrastructure/postgres-repository.js";

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!hasBearerSecret(request, process.env.HMS_WEBHOOK_SECRET)) {
    return response.status(401).json({ error: "Nesprávný secret." });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    await ensurePenaltyMinutesSchema();
    const result = await processFinishedGame(body?.gameId);
    return response.status(200).json({ imported: true, ...result });
  } catch (error) {
    console.error("HMS manual import failed.");
    return response.status(422).json({ imported: false, error: "Import zápasu se nezdařil. Zkontrolujte Game ID a serverovou konfiguraci." });
  }
}
