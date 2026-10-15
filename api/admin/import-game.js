import { processFinishedGame } from "../../src/app/process-finished-game.js";
import { fetchFinishedGameResponses } from "../../src/hms/client.js";
import { hasBearerSecret } from "../../src/security/bearer-secret.js";
import { ensurePenaltyMinutesSchema } from "../../src/infrastructure/postgres-repository.js";

export function describeShape(value, depth = 0) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const typedItems = value.filter((item) => item && typeof item === "object" && typeof item.type === "string");
    const variants = {};
    for (const item of typedItems) {
      if (!variants[item.type] && Object.keys(variants).length < 30) {
        variants[item.type] = {
          count: typedItems.filter((candidate) => candidate.type === item.type).length,
          shape: depth < 3 ? describeShape(item, depth + 1) : "object",
        };
      }
    }
    return {
      type: "array",
      length: value.length,
      first: value.length && depth < 3 ? describeShape(value[0], depth + 1) : undefined,
      ...(Object.keys(variants).length ? { variants } : {}),
    };
  }
  if (typeof value !== "object") return typeof value;
  if (depth >= 3) return "object";
  return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, child]) => [
    key,
    describeShape(child, depth + 1),
  ]));
}

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!hasBearerSecret(request, process.env.HMS_WEBHOOK_SECRET)) {
    return response.status(401).json({ error: "Nesprávný secret." });
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  let diagnostics = null;
  try {
    await ensurePenaltyMinutesSchema();
    const responses = await fetchFinishedGameResponses(body?.gameId);
    diagnostics = {
      game: describeShape(responses[0]),
      events: describeShape(responses[1]),
      lineup: describeShape(responses[2]),
    };
    const result = await processFinishedGame(body?.gameId, { fetchResponses: async () => responses });
    return response.status(200).json({ imported: true, ...result, diagnostics });
  } catch (error) {
    console.error(error);
    return response.status(422).json({ imported: false, error: error.message, diagnostics });
  }
}
