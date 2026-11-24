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

    const diagnostic = result.stderr?.trim() ?? "";
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      // Chrome tracing can fail before the CLI flushes its JSON report to a pipe.
      const traceError = commandError && diagnostic.split(/\r?\n/).find((line) =>
        line.startsWith("Runtime error encountered: ") && line.endsWith("(NO_NAVSTART)"));
      if (!traceError) throw new Error(`Lighthouse did not return a report for ${url}: ${diagnostic.slice(0, 500) || "invalid JSON"}`);
      report = { runtimeError: { code: "NO_NAVSTART", message: traceError } };
    }
    if (!commandError && !report.runtimeError) return report;

    const { code, message } = report.runtimeError ?? {};
    if (code !== "NO_NAVSTART" || attempt === attempts) {
      throw new Error(`Lighthouse failed for ${url} on attempt ${attempt}: ${message ?? code ?? (diagnostic.slice(0, 500) || "unknown error")}`);
    }
    onRetry(attempt, attempts);
    await delay(250);
  }
}
