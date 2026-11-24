import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { inlineScriptHashes } from "./inline-script-hashes.mjs";

const next = ".next";
const vercel = join(next, "output");
const hasVercelOutput = await stat(join(vercel, "config.json")).then(() => true, () => false);
const publicFiles = ["manifest.webmanifest", "icons/app-192-v1.png", "icons/app-512-v1.png"];
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

function prerenderCandidates(name, tree = next) {
  const adapterFiles = hasVercelOutput && tree === next ? [
    join(vercel, "functions", `${name}.prerender-fallback.html`),
    join(vercel, "static", `${name}.html`),
  ] : [];
  const router = name === "404" ? "pages" : "app";
  return [...adapterFiles, join(tree, "server", router, `${name}.html`)];
}

async function existingFiles(candidates) {
  const files = await Promise.all(candidates.map(async (file) => {
    const info = await stat(file).catch((error) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
      throw error;
    });
    return info?.isFile() ? file : null;
  }));
  return files.filter(Boolean);
}

async function secureDocument(file) {
  const html = (await readFile(file, "utf8")).replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, "");
  const hashes = inlineScriptHashes(html);
  if (!hashes.length || !html.includes("<head>")) throw new Error(`Unable to protect release document ${file}.`);
  const policy = `script-src 'self' ${hashes.join(" ")}; script-src-attr 'none'`;
  // The policy travels with the prerender when the service worker serves it offline.
  await writeFile(file, html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));
}

const staticRoot = join(next, "static");
const documents = await Promise.all(Object.entries(routes).map(async ([path, name]) => {
  const candidates = prerenderCandidates(name);
  const [file] = await existingFiles(candidates);
  if (!file) throw new Error(`Missing prerender for ${path}. Checked ${candidates.join(", ")}.`);
  return [path, file];
}));
// Next generates a Pages 404 from the App Router not-found page. Vercel can serve either copy.
const secured = await existingFiles([...Object.values(routes), "404", "_not-found", "_global-error"].flatMap((name) => [
  ...prerenderCandidates(name), ...prerenderCandidates(name, join(next, "standalone", next)),
]));
for (const file of secured) await secureDocument(file);
const html = (await Promise.all(documents.map(([, file]) => readFile(file, "utf8")))).join("\n");
const { polyfillFiles } = JSON.parse(await readFile(join(next, "build-manifest.json"), "utf8"));
const initialScripts = new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)]
  .filter(([tag]) => !/\bnomodule\b/i.test(tag)).map(([, src]) => src));
const staticFiles = (await readdir(staticRoot, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:js|css|woff2?|ico|avif|webp)$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name).slice(staticRoot.length + 1))
  .sort();
const offlineFiles = [];
for (const file of staticFiles) {
  const url = "/_next/static/" + urlPath(file);
  const legacyPolyfill = polyfillFiles.includes("static/" + urlPath(file));
  // This Three.js diagnostic identifies the deferred renderer without relying on a build hash or file size.
  const sceneRenderer = file.endsWith(".js") && (await readFile(join(staticRoot, file), "utf8")).includes("THREE.WebGLRenderer:");
  if (legacyPolyfill || sceneRenderer) {
    if (initialScripts.has(url)) throw new Error(`Optional offline exclusion is now an entry script: ${url}`);
  } else {
    offlineFiles.push([url, join(staticRoot, file)]);
  }
}

if (!offlineFiles.some(([url]) => url.endsWith(".js")) || !offlineFiles.some(([url]) => url.endsWith(".css"))) {
  throw new Error("The production build does not contain the offline shell assets.");
}

const files = [
  ...documents,
  ...offlineFiles,
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
const bytes = (await Promise.all(files.map(([, file]) => stat(file)))).reduce((total, file) => total + file.size, 0);
console.log(`Prepared AirDaybook offline shell ${version} with ${entries.length} files (${bytes} bytes).`);
