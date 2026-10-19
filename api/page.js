import { loadPublicSelection } from "../src/infrastructure/postgres-repository.js";
import { renderPriklepyPage } from "../src/web/render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).send("Method not allowed");
  try {
    const requestedTeamId = String(request.query?.teamId ?? "");
    const teamId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedTeamId)
      ? requestedTeamId
      : null;
    const feed = await loadPublicSelection({ env: process.env, teamId, limit: 30 });
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
    return response.status(200).send(renderPriklepyPage(feed.items, {
      ...feed,
      mode: "selection",
      teamId,
      teamName: teamId ? feed.items.find((item) => item.team)?.team : null,
    }));
  } catch (error) {
    console.error(error);
    return response.status(503).send("Příklepy zatím nejsou připojené k databázi.");
  }
}
