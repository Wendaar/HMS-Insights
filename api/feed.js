import { loadPublicFeedPage } from "../src/infrastructure/postgres-repository.js";
import { renderFeedCards } from "../src/web/render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  try {
    const query = request.query ?? {};
    const page = await loadPublicFeedPage({
      env: process.env,
      limit: query.limit,
      offset: query.offset,
      query: query.q,
      season: query.season,
      group: query.group,
      team: query.team,
      phase: query.phase,
      venue: query.venue,
      sponsor: query.sponsor,
    });
    response.setHeader("cache-control", "no-store");
    return response.status(200).json({
      ...page,
      html: renderFeedCards(page.items, page.offset),
    });
  } catch (error) {
    console.error(error);
    return response.status(503).json({ error: "Feed zatím není dostupný." });
  }
}
