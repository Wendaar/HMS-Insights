import { loadPublicFeedOptions, loadPublicFeedPage } from "../src/infrastructure/postgres-repository.js";
import { renderPriklepyPage } from "../src/web/render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).send("Method not allowed");
  try {
    const [feed, filterOptions] = await Promise.all([
      loadPublicFeedPage({ env: process.env, limit: 40 }),
      loadPublicFeedOptions({ env: process.env }),
    ]);
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
    return response.status(200).send(renderPriklepyPage(feed.items, {
      filterOptions,
      ...feed,
      mode: "archive",
    }));
  } catch (error) {
    console.error(error);
    return response.status(503).send("Archiv Příklepů zatím není dostupný.");
  }
}
