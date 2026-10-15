import { timingSafeEqual } from "node:crypto";
import { processFinishedGame } from "../../../src/app/process-finished-game.js";

function authorized(request, secret) {
  if (!secret) return false;
  const authorization = request.headers.authorization ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : request.headers["x-hms-webhook-secret"] ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!authorized(request, process.env.HMS_WEBHOOK_SECRET)) return response.status(401).json({ error: "Unauthorized" });

  const payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  const gameId = payload?.gameId;
  if (payload?.type === "ping") {
    return response.status(200).json({ accepted: true, type: "ping", eventId: payload.eventId ?? null });
  }
  if (!["game.finished", "game.updated"].includes(payload?.type)) {
    return response.status(202).json({ accepted: false, reason: "unsupported_event" });
  }
  try {
    const result = await processFinishedGame(gameId, { expectedOrganizationId: payload.organizationId });
    return response.status(200).json({ accepted: true, eventId: payload.eventId ?? null, ...result });
  } catch (error) {
    console.error(error);
    return response.status(422).json({ accepted: false, error: error.message });
  }
}
