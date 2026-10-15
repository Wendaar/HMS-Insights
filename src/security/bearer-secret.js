import { timingSafeEqual } from "node:crypto";

export function hasBearerSecret(request, secret) {
  if (!secret) return false;
  const authorization = request.headers.authorization ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : request.headers["x-hms-webhook-secret"] ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
