import {organizationConfig} from "../app/organizations.js";
import { feedDemo } from "../app/feed-demo.js";
import { loadPublicFeed } from "../infrastructure/postgres-repository.js";

export async function loadFeedForRequest(env = process.env, options = {}) {
  const { loadFeed = loadPublicFeed, ...repositoryOptions } = options;
  if (env.DATABASE_URL) {
    const items = await loadFeed({ ...repositoryOptions, env, organizationId:organizationConfig("PHM",env).id });
    if (items.length > 0 || env.ALLOW_DEMO_FEED !== "true") {
      return { items, mode: "database" };
    }
  }
  if (env.ALLOW_DEMO_FEED === "true") return { items: feedDemo, mode: "demo" };
  throw new Error("Feed nemá připojenou databázi a ukázkový režim není povolen.");
}
