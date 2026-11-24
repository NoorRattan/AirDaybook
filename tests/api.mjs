import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm, rmdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { examples, fixtureKey, providerDetail } from "./fixtures/groq-provider.mjs";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const app = new URL("../.next/standalone/", import.meta.url);
const providerFixture = new URL("./fixtures/groq-provider.mjs", import.meta.url);
const preferences = {
  hasPurifier: true, metroAvailable: null, canMoveActivityIndoors: null, canCombineErrands: null,
};
const revisionId = "api-contract-test";
const endpoint = "/api/v1/revisions";

async function localPort() {
  const socket = createServer();
  const listening = once(socket, "listening");
  socket.listen(0, "127.0.0.1");
  await listening;
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function withRelease(settings, check) {
  await access(new URL("server.js", app)).catch(() => assert.fail("Run npm run build before the API checks."));
  const port = await localPort();
  const origin = `http://127.0.0.1:${port}`;
  const temporary = await mkdtemp(join(tmpdir(), "airdaybook-api-"));
  const child = spawn(process.execPath, ["--import", providerFixture.href, "server.js"], {
    cwd: fileURLToPath(app),
    env: {
      ...process.env, NODE_ENV: "production", NODE_OPTIONS: "", NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "127.0.0.1", PORT: String(port), APP_ORIGIN: origin, VERCEL: "0",
      RELEASE_ID: "api-contract-test", AIRDAYBOOK_TEST_PROVIDER: "1", GROQ_API_KEY: fixtureKey,
      GROQ_MODEL: "openai/gpt-oss-20b", AI_QUOTA_DATABASE_URL: "", AI_QUOTA_DB_PATH: join(temporary, "quota.sqlite"),
      AI_ENABLED: "true", AI_DAILY_LIMIT: "4", AI_BURST_PER_MINUTE: "4", AI_MAX_CONCURRENT: "1",
      AI_PROVIDER_TIMEOUT_MS: "1000", ...settings,
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  let spawnError;
  const closed = new Promise((resolve) => child.once("close", resolve));
  child.once("error", (error) => { spawnError = error; });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  }

  const get = (path, options = {}) => fetch(`${origin}${path}`, {
    redirect: "error", signal: AbortSignal.timeout(7000), ...options,
  });
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("Release process exited before becoming ready.");
      const health = await get("/api/health", { signal: AbortSignal.timeout(500) }).catch(() => undefined);
      if (health?.ok) {
        assert.deepEqual(await health.json(), { status: "ok" });
        await check({ get, origin });
        return;
      }
      await health?.body?.cancel();
      await delay(150);
    }
    assert.fail("The release did not become ready.");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      await rm(join(temporary, `quota.sqlite${suffix}`), { force: true });
    }
    await rmdir(temporary);
    for (const privateValue of [fixtureKey, providerDetail, ...Object.values(examples)]) {
      assert(!output.includes(privateValue), "Operational logs exposed fixture input or provider details.");
    }
  }
}

async function capability(get, available) {
  const response = await get(endpoint);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await response.json(), { available });
}

function submit({ get, origin }, text, { headers = {}, input = {} } = {}) {
  return get(endpoint, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ revisionId, text, preferences, ...input }),
  });
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const data = await response.json();
  assert.deepEqual(data, { error: { code }, requestId: data.requestId });
  assert.match(data.requestId, /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/);
  if (status === 429) assert(Number(response.headers.get("retry-after")) > 0);
}

test("feature disabled: capability is false and revisions fail closed", async () => {
  await withRelease({ AI_ENABLED: "false" }, async (release) => {
    await capability(release.get, false);
    await expectError(await submit(release, examples.apply), 503, "ai_unavailable");
  });
});

test("configuration rejected: capability is false and health remains available", async () => {
  await withRelease({ AI_DAILY_LIMIT: "-1" }, async (release) => {
    await capability(release.get, false);
    await expectError(await submit(release, examples.apply), 503, "ai_unavailable");
  });
});

test("enabled revisions validate requests and map provider responses", async (suite) => {
  await withRelease({}, async (release) => {
    await capability(release.get, true);
    await suite.test("rejects requests with incompatible metadata or payload fields", async () => {
      await expectError(await submit(release, examples.apply, { headers: { Origin: "https://example.invalid" } }), 403, "origin_denied");
      await expectError(await submit(release, examples.apply, { headers: { "Sec-Fetch-Site": "cross-site" } }), 403, "origin_denied");
      await expectError(await submit(release, examples.apply, { headers: { "Content-Type": "text/plain" } }), 415, "unsupported_media_type");
      await expectError(await submit(release, examples.apply, { input: { scheduledTime: "15:00" } }), 400, "invalid_request");
      await expectError(await submit(release, "Write to name@example.com."), 400, "invalid_request");
      await expectError(await submit(release, examples.apply, { input: { revisionId: "invalid space" } }), 400, "invalid_request");
      for (const body of ["", "{", Buffer.from([0xff])]) {
        await expectError(await release.get(endpoint, { method: "POST", headers: { Origin: release.origin, "Content-Type": "application/json" }, body }), 400, "invalid_request");
      }
      await expectError(await submit(release, "x".repeat(9 * 1024)), 413, "payload_too_large");
      const encoded = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded.encode(" ".repeat(4096)));
          controller.enqueue(encoded.encode(" ".repeat(4097)));
          controller.close();
        },
      });
      await expectError(await release.get(endpoint, {
        method: "POST", headers: { Origin: release.origin, "Content-Type": "application/json" }, body, duplex: "half",
      }), 413, "payload_too_large");
    });
    await suite.test("applies only an allowed preference directive in valid provider JSON", async () => {
      const response = await submit(release, examples.apply);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { revisionId, outcome: "apply", changes: { hasPurifier: false } });
    });
    await suite.test("returns stable errors for invalid, unavailable and timed-out provider responses", async () => {
      await expectError(await submit(release, examples.malformed), 502, "provider_response_invalid");
      await expectError(await submit(release, examples.unavailable), 503, "ai_unavailable");
      await expectError(await submit(release, examples.timeout), 504, "provider_timeout");
    });
  });
});

test("quota counts admitted requests and returns Retry-After", async () => {
  await withRelease({ AI_BURST_PER_MINUTE: "1" }, async (release) => {
    await expectError(await submit(release, examples.apply, { input: { scheduledTime: "15:00" } }), 400, "invalid_request");
    const admitted = await submit(release, examples.apply);
    assert.equal(admitted.status, 200);
    await admitted.body?.cancel();
    await expectError(await submit(release, examples.apply), 429, "usage_limited");
  });
});

test("assistant output is grounded in an allowed action, and provider failures stay bounded", async () => {
  await withRelease({ AI_DAILY_LIMIT: "5", AI_BURST_PER_MINUTE: "5" }, async (release) => {
    const recommendation = await submit(release, examples.assistant, { input: { assistant: true } });
    assert.deepEqual(await recommendation.json(), { revisionId, outcome: "apply", changes: {}, tool: "routes" });
    assert.deepEqual(await (await submit(release, examples.clarify)).json(), { revisionId, outcome: "clarify", changes: {} });
    await expectError(await submit(release, examples.truncated), 502, "provider_response_invalid");
    await expectError(await submit(release, examples.oversized), 502, "provider_response_invalid");
    await expectError(await submit(release, examples.network), 503, "ai_unavailable");
  });
});

test("routine revision accepts only activities grounded in submitted English and Hindi text", async () => {
  await withRelease({}, async (release) => {
    await expectError(await submit(release, examples.itinerary, { input: { routineDraft: true } }), 400, "invalid_request");
    const response = await submit(release, examples.itinerary, { input: { assistant: true, routineDraft: true } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      revisionId, outcome: "apply", changes: {}, activities: [
        { name: "Evening walk", time: "18:00", minutes: 30, outdoors: true, fixed: false, strenuous: false },
        { name: "रात का खाना", time: "20:00", minutes: 45, outdoors: false, fixed: true, strenuous: false },
      ],
    });
  });
});

test("SQLite concurrency, burst and daily counters survive alongside another process and across restarts", async () => {
  const temp = await mkdtemp(join(tmpdir(), "airdaybook-shared-"));
  const settings = { AI_QUOTA_DB_PATH: join(temp, "quota.sqlite"), AI_DAILY_LIMIT: "2", AI_BURST_PER_MINUTE: "2" };
  try {
    await withRelease(settings, async (first) => {
      await withRelease(settings, async (second) => {
        const active = submit(first, examples.timeout);
        await delay(260);
        const limited = await submit(second, examples.apply);
        assert.equal(limited.headers.get("Retry-After"), "1");
        await expectError(limited, 429, "usage_limited");
        await expectError(await active, 504, "provider_timeout");
        const admitted = await submit(second, examples.apply);
        assert.equal(admitted.status, 200);
        await admitted.body?.cancel();
      });
    });
    await withRelease(settings, async (replacement) => {
      const limited = await submit(replacement, examples.apply);
      assert(Number(limited.headers.get("Retry-After")) <= 60);
      await expectError(limited, 429, "usage_limited");
    });
    await withRelease({ ...settings, AI_BURST_PER_MINUTE: "4" }, async (replacement) => {
      await expectError(await submit(replacement, examples.apply), 429, "usage_limited");
    });
    await withRelease({ AI_QUOTA_DB_PATH: join(temp, "missing", "quota.sqlite") }, async (release) => {
      await expectError(await submit(release, examples.apply), 503, "ai_unavailable");
      assert.equal((await release.get("/api/health")).status, 200);
    });
  } finally {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) await rm(settings.AI_QUOTA_DB_PATH + suffix, { force: true });
    await rmdir(temp);
  }
});

const postgresUrl = process.env.AIRDAYBOOK_TEST_POSTGRES_URL;
test("Postgres shares Vercel per-client and global allowances between app instances", { skip: !postgresUrl }, async () => {
  const url = new URL(postgresUrl);
  assert(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Use a local disposable Postgres service.");
  const sql = postgres(url.href, { connect_timeout: 5 });
  const database = "airdaybook_test_" + randomUUID().replaceAll("-", "");
  await sql`CREATE DATABASE ${sql(database)}`;
  url.pathname = "/" + database;
  const settings = { VERCEL: "1", AI_QUOTA_DATABASE_URL: url.href, AI_DAILY_LIMIT: "3", AI_CLIENT_DAILY_LIMIT: "1" };
  const edge = (ip) => ({ headers: { "x-vercel-forwarded-for": ip } });
  try {
    await withRelease(settings, async (first) => {
      await withRelease(settings, async (second) => {
        await expectError(await submit(first, examples.apply, { headers: { "x-forwarded-for": "192.0.2.1" } }), 503, "ai_unavailable");
        assert.equal((await submit(first, examples.apply, edge("192.0.2.1"))).status, 200);
        await expectError(await submit(second, examples.apply, edge("::ffff:192.0.2.1")), 429, "usage_limited");
        assert.equal((await submit(second, examples.apply, edge("192.0.2.2"))).status, 200);
        assert.equal((await submit(first, examples.apply, edge("192.0.2.3"))).status, 200);
        await expectError(await submit(second, examples.apply, edge("192.0.2.4")), 429, "usage_limited");
      });
    });
    await withRelease({ ...settings, AI_DAILY_LIMIT: "7", AI_CLIENT_DAILY_LIMIT: "3", AI_BURST_PER_MINUTE: "10" }, async (release) => {
      assert.equal((await submit(release, examples.apply, edge("192.0.2.5"))).status, 200);
      assert.equal((await submit(release, examples.apply, edge("192.0.2.5"))).status, 200);
      const capped = await submit(release, examples.apply, edge("192.0.2.5"));
      assert(Number(capped.headers.get("Retry-After")) <= 60);
      await expectError(capped, 429, "usage_limited");
      assert.equal((await submit(release, examples.apply, edge("192.0.2.6"))).status, 200);
    });
  } finally {
    await sql`DROP DATABASE ${sql(database)} WITH (FORCE)`;
    await sql.end();
  }
});
