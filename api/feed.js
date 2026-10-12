import { loadFeedForRequest } from "../src/web/feed-loader.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  try {
    const feed = await loadFeedForRequest(process.env);
    response.setHeader("cache-control", feed.mode === "database" ? "s-maxage=60, stale-while-revalidate=300" : "no-store");
    return response.status(200).json(feed);
  } catch (error) {
    console.error(error);
    return response.status(503).json({ error: "Feed zatím není dostupný." });
  }
}
