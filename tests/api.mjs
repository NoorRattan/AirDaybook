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
      await expectError(await submit(release, examples.apply, { headers: { "Content-Type": "text/plain" } }), 415, "unsupported_media_type");
      await expectError(await submit(release, examples.apply, { input: { scheduledTime: "15:00" } }), 400, "invalid_request");
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
