import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

const next = ".next";
const vercel = join(next, "output");
const hasVercelOutput = await stat(join(vercel, "config.json")).then(() => true, () => false);
const publicFiles = ["delhi-metro-dawn.webp", "delhi-metro-dawn-small.webp"];
const routes = {
  "/": "index",
  "/plan": "plan",
};

function urlPath(file) {
  return file.split(sep).map(encodeURIComponent).join("/");
}

async function integrity(file) {
  return "sha256-" + createHash("sha256").update(await readFile(file)).digest("base64");
}

async function prerenderedFile(path, name) {
  const candidates = hasVercelOutput ? [
    join(vercel, "functions", `${name}.prerender-fallback.html`),
    join(vercel, "static", `${path}.html`),
    join(vercel, "static", `${name}.html`),
  ] : [];
  candidates.push(join(next, "server", "app", `${name}.html`));
  for (const file of candidates) {
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  throw new Error(`Missing prerender for ${path}. Checked ${candidates.join(", ")}.`);
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
  ...await Promise.all(Object.entries(routes).map(async ([path, name]) => [path, await prerenderedFile(path, name)])),
  ...staticFiles.map((file) => ["/_next/static/" + urlPath(file), join(staticRoot, file)]),
  ...publicFiles.map((file) => ["/" + file, join("public", file)]),
];
const entries = await Promise.all(files.map(async ([url, file]) => [url, await integrity(file)]));
const worker = await readFile(new URL("offline-worker.js", import.meta.url), "utf8");
const nextBuildId = (await readFile(join(next, "BUILD_ID"), "utf8")).trim();
const version = createHash("sha256").update(JSON.stringify([nextBuildId, entries, worker])).digest("hex").slice(0, 20);
const manifest = { version, routes: Object.keys(routes), entries };
const source = `const airdaybookBuild = ${JSON.stringify(manifest)};\n${worker}`;
await writeFile("public/sw.js", source, "utf8");
// Vercel's Next.js adapter has already copied public files when this step runs.
if (hasVercelOutput) await writeFile(join(vercel, "static", "sw.js"), source, "utf8");
console.log(`Prepared AirDaybook offline shell ${version} with ${entries.length} files.`);
