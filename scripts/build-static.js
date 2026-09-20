import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedDemo } from "../src/app/feed-demo.js";
import { renderPriklepyPage } from "../src/web/render.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "docs");

await mkdir(output, { recursive: true });
await writeFile(join(output, "index.html"), renderPriklepyPage(feedDemo), "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");

for (const asset of ["app.js", "favicon.svg", "styles.css"]) {
  await copyFile(join(root, "public", asset), join(output, asset));
}

console.log("Veřejná statická ukázka je připravena ve složce docs.");
