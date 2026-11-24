import { setTimeout as delay } from "node:timers/promises";

export async function collectLighthouseReport(collect, { url, onRetry = () => {} }) {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let result;
    let commandError;
    try {
      result = await collect();
    } catch (error) {
      commandError = error;
      result = error;
    }

    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      throw new Error(`Lighthouse did not return a report for ${url}: ${result.stderr?.trim().slice(0, 500) || "invalid JSON"}`);
    }
    if (!commandError && !report.runtimeError) return report;

    const { code, message } = report.runtimeError ?? {};
    if (code !== "NO_NAVSTART" || attempt === attempts) {
      throw new Error(`Lighthouse failed for ${url} on attempt ${attempt}: ${message ?? code ?? result.stderr?.trim().slice(0, 500) ?? "unknown error"}`);
    }
    onRetry(attempt, attempts);
    await delay(250);
  }
}
