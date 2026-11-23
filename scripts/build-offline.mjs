import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

const next = ".next";
const publicFiles = ["delhi-metro-dawn.webp", "delhi-metro-dawn-small.webp"];
const routes = {
  "/": join(next, "server", "app", "index.html"),
  "/plan": join(next, "server", "app", "plan.html"),
};

function urlPath(file) {
  return file.split(sep).map(encodeURIComponent).join("/");
}

async function integrity(file) {
  return "sha256-" + createHash("sha256").update(await readFile(file)).digest("base64");
}

const staticRoot = join(next, "static");
const staticFiles = (await readdir(staticRoot, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:js|css|woff2?|ico)$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name).slice(staticRoot.length + 1))
  .sort();

if (!staticFiles.some((file) => file.endsWith(".js")) || !staticFiles.some((file) => file.endsWith(".css"))) {
  throw new Error("The production build does not contain the offline shell assets.");
}

const files = [
  ...Object.entries(routes),
  ...staticFiles.map((file) => ["/_next/static/" + urlPath(file), join(staticRoot, file)]),
  ...publicFiles.map((file) => ["/" + file, join("public", file)]),
];
const entries = await Promise.all(files.map(async ([url, file]) => [url, await integrity(file)]));
const worker = await readFile(new URL("offline-worker.js", import.meta.url), "utf8");
const nextBuildId = (await readFile(join(next, "BUILD_ID"), "utf8")).trim();
const version = createHash("sha256").update(JSON.stringify([nextBuildId, entries, worker])).digest("hex").slice(0, 20);
const manifest = { version, routes: Object.keys(routes), entries };
await writeFile("public/sw.js", `const airdaybookBuild = ${JSON.stringify(manifest)};\n${worker}`, "utf8");
console.log(`Prepared AirDaybook offline shell ${version} with ${entries.length} files.`);
