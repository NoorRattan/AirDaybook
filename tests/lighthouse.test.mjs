import assert from "node:assert/strict";
import { test } from "node:test";
import { collectLighthouseReport } from "../scripts/lighthouse-report.mjs";

const url = "http://127.0.0.1:3000/plan";
function runtimeFailure(code) {
  return Object.assign(new Error("Lighthouse exited with status 1"), {
    stdout: JSON.stringify({ runtimeError: { code, message: `Trace error (${code})` } }),
  });
}

test("retries a missing navigation trace and returns the successful report", async () => {
  let calls = 0;
  const retried = [];
  const result = await collectLighthouseReport(async () => {
    if (++calls === 1) throw runtimeFailure("NO_NAVSTART");
    return { stdout: JSON.stringify({ categories: { performance: { score: 0.8 } } }) };
  }, { url, onRetry: (attempt) => retried.push(attempt) });
  assert.deepEqual(retried, [1]);
  assert.equal(result.categories.performance.score, 0.8);
});

test("fails after three missed traces", async () => {
  await assert.rejects(collectLighthouseReport(async () => { throw runtimeFailure("NO_NAVSTART"); }, { url }), /attempt 3.*NO_NAVSTART/);
});

test("fails immediately when a Lighthouse runtime error differs", async () => {
  let calls = 0;
  await assert.rejects(collectLighthouseReport(async () => {
    calls++;
    throw runtimeFailure("ERRORED_DOCUMENT_REQUEST");
  }, { url }), /attempt 1.*ERRORED_DOCUMENT_REQUEST/);
  assert.equal(calls, 1);
});
