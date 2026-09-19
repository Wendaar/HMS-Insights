import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sampleAnalysis } from "./app/sample.js";
import { feedDemo } from "./app/feed-demo.js";
import { renderPriklepyPage } from "./web/render.js";

const directory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(directory, "..", "public");
const port = Number(process.env.PORT ?? 3000);

const assets = {
  "/styles.css": ["text/css; charset=utf-8", "styles.css"],
  "/app.js": ["text/javascript; charset=utf-8", "app.js"],
  "/favicon.svg": ["image/svg+xml", "favicon.svg"],
};

export const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/") {
    response.writeHead(302, { location: "/priklepy" });
    response.end();
    return;
  }
  if (url.pathname === "/priklepy") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderPriklepyPage(feedDemo));
    return;
  }
  if (url.pathname === "/api/priklepy") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(sampleAnalysis));
    return;
  }
  if (url.pathname === "/api/feed") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(feedDemo));
    return;
  }
  if (assets[url.pathname]) {
    const [contentType, filename] = assets[url.pathname];
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(await readFile(join(publicDirectory, filename)));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Nenalezeno");
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`HMS Insights běží na http://localhost:${port}/priklepy`));
}
