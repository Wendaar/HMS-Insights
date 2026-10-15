import { fetchOrganization } from "../src/hms/client.js";

export default async function handler(_request, response) {
  let hmsApi = false;
  if (process.env.HMS_API_TOKEN) {
    try {
      await fetchOrganization();
      hmsApi = true;
    } catch (error) {
      console.error("HMS health check failed", error.message);
    }
  }
  const checks = {
    database: Boolean(process.env.DATABASE_URL),
    hmsApi,
    webhookSecurity: Boolean(process.env.HMS_WEBHOOK_SECRET),
  };
  response.status(Object.values(checks).every(Boolean) ? 200 : 503).json({
    service: "hms-insights",
    region: process.env.VERCEL_REGION ?? "local",
    ready: Object.values(checks).every(Boolean),
    checks,
  });
}
