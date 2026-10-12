import { feedDemo } from "../app/feed-demo.js";
import { loadPublicFeed } from "../infrastructure/postgres-repository.js";

export async function loadFeedForRequest(env = process.env, options = {}) {
  if (env.DATABASE_URL) {
    return { items: await loadPublicFeed({ ...options, env }), mode: "database" };
  }
  if (env.ALLOW_DEMO_FEED === "true") return { items: feedDemo, mode: "demo" };
  throw new Error("Feed nemá připojenou databázi a ukázkový režim není povolen.");
}
