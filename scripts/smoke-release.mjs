import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
assert.equal(origin.href, origin.origin + "/", "Supply the root origin of the release.");
assert(origin.protocol === "https:" || (loopback && origin.protocol === "http:"), "Use an HTTPS origin or local HTTP.");

function get(path, options = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin.origin);
  return fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), ...options });
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

for (const [path, expected] of entries) {
  assert(path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/"), `Unexpected cache path ${path}`);
  const response = await get(path);
  assert(response.ok, `${path} returned ${response.status}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const data = Buffer.from(await response.arrayBuffer());
  const integrity = "sha256-" + createHash("sha256").update(data).digest("base64");
  assert.equal(integrity, expected, `${path} does not match the offline manifest.`);
  if (routes.includes(path)) {
    assert.match(data.toString("utf8"), /<title>[^<]*AirDaybook[^<]*<\/title>/);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
}
console.log(JSON.stringify({ origin: origin.origin, health: "ok", offlineVersion: version, verifiedFiles: entries.length }));
