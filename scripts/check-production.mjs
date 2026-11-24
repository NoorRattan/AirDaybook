import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const origin = "https://airdaybook.vercel.app";
const institutions = new Set([
  "airquality.cpcb.gov.in", "caqm.nic.in", "delhimetrorail.com", "ncdc.mohfw.gov.in",
  "open-meteo.com", "www.cdc.gov", "www.epa.gov", "www.mha.gov.in", "www.teriin.org",
]);

async function citations() {
  const root = new URL("../src/", import.meta.url);
  const links = new Set();
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const source = await readFile(`${entry.parentPath}/${entry.name}`, "utf8");
    for (const [link] of source.matchAll(/https:\/\/[^"'`\s<>]+/g)) {
      const url = URL.parse(link);
      if (!url || !institutions.has(url.hostname)) continue;
      url.hash = "";
      links.add(url.href);
    }
  }
  assert(links.size > 0, "No institutional citations found in source.");
  return [...links].sort();
}

async function checkEndpoint(path, validate) {
  const response = await fetch(origin + path, { redirect: "error", signal: AbortSignal.timeout(12_000) });
  assert(response.ok, `HTTP ${response.status}`);
  validate(await response.json(), response.headers);
  console.log(`OK ${path}`);
}

async function checkCitation(link) {
  // Some publishers only support GET. Cancel the body after the headers arrive.
  const options = { headers: { "User-Agent": "AirDaybook citation checker (github.com/NoorRattan/AirDaybook)" } };
  let response = await fetch(link, { ...options, method: "HEAD", signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!response?.ok) response = await fetch(link, { ...options, signal: AbortSignal.timeout(15_000) });
  await response.body?.cancel();
  assert(response.ok, `HTTP ${response.status}`);
  assert.equal(new URL(response.url).protocol, "https:", "Citation redirected outside HTTPS");
  console.log(`OK ${link}`);
}

async function report(label, check, allowConnectTimeout = false) {
  try {
    await check();
  } catch (error) {
    if (allowConnectTimeout && (error.name === "TimeoutError" || error.cause?.code === "UND_ERR_CONNECT_TIMEOUT")) {
      console.warn(`::warning::${label} timed out from this runner after both HEAD and GET. Verify the citation from another network.`);
      return;
    }
    console.error(`${label} ${error.cause?.code ?? error.message}`);
    process.exitCode = 1;
  }
}

await Promise.all([
  report("Core health", () => checkEndpoint("/api/health", (body, headers) => {
    assert.deepEqual(body, { status: "ok" });
    assert.match(headers.get("x-airdaybook-release") ?? "", /^[a-f0-9]{12}$/);
  })),
  report("AI availability", () => checkEndpoint("/api/v1/revisions", (body) => assert.equal(body.available, true))),
  ...((await citations()).map((link) => report(link, () => checkCitation(link), new URL(link).hostname === "airquality.cpcb.gov.in"))),
]);
