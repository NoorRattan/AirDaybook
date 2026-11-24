import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const cli = fileURLToPath(new URL("../node_modules/lighthouse/cli/index.js", import.meta.url));
const origin = process.env.AIRDAYBOOK_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const reportOnly = process.argv.includes("--report-only");
const releaseGate = process.argv.includes("--release-gate");
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const metrics = new Map([["/", []], ["/plan", []]]);

for (let round = 0; round < 3; round++) {
  for (const [route, scores] of metrics) {
    const { stdout } = await run(process.execPath, [
      cli, new URL(route, origin).href, "--quiet", "--output=json", "--output-path=stdout",
      "--only-categories=performance,accessibility,best-practices,seo", "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
    ], { env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? chromium.executablePath() }, maxBuffer: 15_000_000 });
    const { audits, categories, runtimeError } = JSON.parse(stdout);
    assert(!runtimeError, runtimeError?.message);
    const result = {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      bestPractices: Math.round(categories["best-practices"].score * 100),
      seo: Math.round(categories.seo.score * 100),
      lcp: Math.round(audits["largest-contentful-paint"].numericValue),
      tbt: Math.round(audits["total-blocking-time"].numericValue),
      cls: audits["cumulative-layout-shift"].numericValue,
    };
    scores.push(result);
    console.log(JSON.stringify({ route, run: round + 1, ...result }));
  }
}

const failures = [];
const targets = [];
for (const [route, scores] of metrics) {
  const result = Object.fromEntries(Object.keys(scores[0]).map((metric) => [metric, median(scores.map((score) => score[metric]))]));
  console.log(JSON.stringify({ route, median: result }));
  if (result.performance < 95) targets.push(`${route}: Performance ${result.performance} < 95`);
  if (result.performance < 80) failures.push(`${route}: Performance ${result.performance} < 80`);
  for (const key of ["accessibility", "bestPractices", "seo"]) {
    if (result[key] < 100) failures.push(`${route}: ${key} ${result[key]} < 100`);
  }
  if (result.cls >= 0.05) failures.push(`${route}: CLS ${result.cls} >= 0.05`);
  if (result.lcp > 2500) targets.push(`${route}: LCP ${result.lcp} ms > 2500 ms`);
  if (result.lcp > 3200) failures.push(`${route}: LCP ${result.lcp} ms > 3200 ms`);
}
if (targets.length) console.warn(targets.join("\n"));
if (failures.length) console.error(failures.join("\n"));
if (!reportOnly) assert.equal(failures.length + (releaseGate ? 0 : targets.length), 0, "The release exceeded its mobile Lighthouse budgets.");
