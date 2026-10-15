export default function handler(_request, response) {
  const checks = {
    database: Boolean(process.env.DATABASE_URL),
    hmsApi: Boolean(process.env.HMS_API_TOKEN),
    webhookSecurity: Boolean(process.env.HMS_WEBHOOK_SECRET),
  };
  response.status(Object.values(checks).every(Boolean) ? 200 : 503).json({
    service: "hms-insights",
    region: process.env.VERCEL_REGION ?? "local",
    ready: Object.values(checks).every(Boolean),
    checks,
  });
}
