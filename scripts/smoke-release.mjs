import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { inlineScriptHashes } from "./inline-script-hashes.mjs";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
assert.equal(origin.href, origin.origin + "/", "Supply the root origin of the release.");
assert(origin.protocol === "https:" || (loopback && origin.protocol === "http:"), "Use an HTTPS origin or local HTTP.");

function get(path, options = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin.origin);
  return fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), ...options });
}

function assertScriptPolicy(html, path) {
  const [, policy] = html.match(/<head><meta http-equiv="Content-Security-Policy" content="([^"]+)">/) ?? [];
  const hashes = inlineScriptHashes(html);
  assert(hashes.length > 0, `${path} should contain inline bootstrap scripts.`);
  assert.equal(policy, `script-src 'self' ${hashes.join(" ")}; script-src-attr 'none'`, `${path} must protect its bootstrap scripts.`);
}

let health;
for (let attempt = 0; attempt < 30; attempt++) {
  health = await get("/api/health").catch(() => undefined);
  if (health?.ok) break;
  await health?.body?.cancel();
  await delay(250);
}
assert(health?.ok, "Core health did not become ready.");
assert.deepEqual(await health.json(), { status: "ok" });
assert.match(health.headers.get("cache-control") ?? "", /no-store/);
assert.match(health.headers.get("content-security-policy") ?? "", /default-src 'none'/);
assert.equal(health.headers.get("strict-transport-security"), "max-age=63072000; includeSubDomains; preload");
const rejected = await get("/api/health", { method: "POST" });
assert.equal(rejected.status, 405);
assert.equal(rejected.headers.get("allow"), "GET, HEAD, OPTIONS");

for (const path of ["/missing-release-smoke-page", "/plan/missing-release-smoke-page", "/404"]) {
  const missing = await get(path);
  assert.equal(missing.status, 404, path);
  const html = await missing.text();
  assert.match(html, /<title>Page not found · AirDaybook<\/title>/);
  assertScriptPolicy(html, path);
  assert.match(missing.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
}
const manifestResponse = await get("/manifest.webmanifest");
assert(manifestResponse.ok, "The install manifest must be published.");
const installManifest = await manifestResponse.json();
assert.equal(installManifest.start_url, "/");
assert.equal(installManifest.display, "standalone");
assert(installManifest.icons.some(({ purpose }) => purpose.split(" ").includes("maskable")));
for (const file of ["/robots.txt", "/sitemap.xml", "/social/airdaybook.jpg", "/icons/apple-touch-v1.png"]) {
  const resource = await get(file, { method: "HEAD" });
  assert(resource.ok, `${file} must be published.`);
}
const disclosure = await get("/.well-known/security.txt");
assert(disclosure.ok, "The security disclosure file must be published.");
assert.match(disclosure.headers.get("content-type") ?? "", /^text\/plain\b/i);
const disclosureText = await disclosure.text();
assert.match(disclosureText, /^Contact: https:\/\/github\.com\/NoorRattan\/AirDaybook\/security\/advisories\/new\r?$/m);
const expiration = Date.parse(/^Expires: (.+)$/m.exec(disclosureText)?.[1] ?? "");
assert(expiration > Date.now(), "Renew the expiration in security.txt.");

const worker = await get("/sw.js");
assert(worker.ok, "The offline worker must be published.");
assert.match(worker.headers.get("cache-control") ?? "", /no-store/);
const workerSource = await worker.text();
const manifestLine = /^const airdaybookBuild = (.+);$/m.exec(workerSource);
assert(manifestLine, "The release build must generate an offline manifest.");
const { entries, routes, version } = JSON.parse(manifestLine[1]);
assert.match(version, /^[a-f0-9]{20}$/);
assert.deepEqual(routes, ["/", "/plan"]);
assert(routes.every((route) => entries.some(([path]) => path === route)));

let offlineBytes = 0;
for (const [path, expected] of entries) {
  assert(path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/"), `Unexpected cache path ${path}`);
  const response = await get(path);
  assert(response.ok, `${path} returned ${response.status}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const data = Buffer.from(await response.arrayBuffer());
  offlineBytes += data.length;
  const integrity = "sha256-" + createHash("sha256").update(data).digest("base64");
  assert.equal(integrity, expected, `${path} does not match the offline manifest.`);
  if (routes.includes(path)) {
    const html = data.toString("utf8");
    assert.match(html, /<title>[^<]*AirDaybook[^<]*<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/airdaybook\.vercel\.app/);
    assert.match(html, /<meta property="og:image" content="https:\/\/airdaybook\.vercel\.app\/social\/airdaybook\.jpg"/);
    if (path === "/") {
      const imageHints = [...html.matchAll(/<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")[^>]*\bhref="([^"]+\.avif)"[^>]*>/g)];
      assert.equal(imageHints.length, 2, "Today must have one AVIF preload per viewport range.");
      assert.equal(new Set(imageHints.map(([, src]) => src)).size, 2);
      for (const [, src] of imageHints) {
        assert(entries.some(([url]) => url === src), `The offline shell must include ${src}.`);
        const image = await get(src, { method: "HEAD" });
        assert.match(image.headers.get("cache-control") ?? "", /immutable/);
      }
    }
    assertScriptPolicy(html, path);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
}
assert(offlineBytes <= 1_100_000, `Offline shell exceeds 1.1 MB before HTTP compression: ${offlineBytes} bytes.`);
console.log(JSON.stringify({ origin: origin.origin, health: "ok", offlineVersion: version, verifiedFiles: entries.length, offlineBytes }));
