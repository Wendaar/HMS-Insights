import { loadPublicSelection } from "../src/infrastructure/postgres-repository.js";
import { renderFeedCards } from "../src/web/render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  try {
    const requestedTeamId = String(request.query?.teamId ?? "");
    const teamId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedTeamId)
      ? requestedTeamId
      : null;
    const result = await loadPublicSelection({
      env: process.env,
      teamId,
      query: request.query?.q,
      group: request.query?.group,
      team: request.query?.team,
      limit: 30,
    });
    response.setHeader("cache-control", "s-maxage=30, stale-while-revalidate=120");
    return response.status(200).json({ ...result, html: renderFeedCards(result.items) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Výběr Příklepů se nepodařilo načíst." });
  }
}
