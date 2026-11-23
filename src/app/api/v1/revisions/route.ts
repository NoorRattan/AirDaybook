import { randomUUID } from "node:crypto";
import { revisionRequestSchema } from "@/lib/revision-schema";
import { aiConfiguration } from "@/lib/server/ai-config";
import { interpretRevision } from "@/lib/server/groq-revisions";
import { reserveRevision } from "@/lib/server/quota";

export const runtime = "nodejs";

const bodyLimit = 8 * 1024;
const errors = {
  invalid_request: 400,
  origin_denied: 403,
  payload_too_large: 413,
  unsupported_media_type: 415,
  usage_limited: 429,
  provider_response_invalid: 502,
  ai_unavailable: 503,
  provider_timeout: 504,
} as const;
type ErrorCode = keyof typeof errors;

async function requestBody(request: Request): Promise<{ value: unknown } | { error: ErrorCode }> {
  if (Number(request.headers.get("content-length")) > bodyLimit) return { error: "payload_too_large" };
  const reader = request.body?.getReader();
  if (!reader) return { error: "invalid_request" };
  const timeout = AbortSignal.timeout(4000);
  const signal = AbortSignal.any([request.signal, timeout]);
  const canceled = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", canceled, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let encodedBytes = 0;
  let content = "";
  try {
    if (signal.aborted) return { error: "invalid_request" };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      encodedBytes += value.byteLength;
      if (encodedBytes > bodyLimit) return { error: "payload_too_large" };
      content += decoder.decode(value, { stream: true });
    }
    return signal.aborted ? { error: "invalid_request" } : { value: JSON.parse(content + decoder.decode()) };
  } catch {
    return { error: "invalid_request" };
  } finally {
    signal.removeEventListener("abort", canceled);
    canceled();
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = randomUUID();

  function reply(body: unknown, status: number, outcome: string, retryAfter?: number) {
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (retryAfter !== undefined) headers.set("Retry-After", String(retryAfter));
    console.info(JSON.stringify({
      event: "plan_revision", requestId, release: process.env.RELEASE_ID ?? "local",
      status, outcome, elapsedMs: Date.now() - started,
    }));
    return Response.json(body, { status, headers });
  }

  function fail(code: ErrorCode, retryAfter?: number) {
    return reply({ error: { code }, requestId }, errors[code], code, retryAfter);
  }

  const config = aiConfiguration();
  if (!config) return fail("ai_unavailable");

  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== config.origin || (fetchSite && fetchSite !== "same-origin")) {
    return fail("origin_denied");
  }
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") return fail("unsupported_media_type");
  const body = await requestBody(request);
  if ("error" in body) return fail(body.error);
  const input = revisionRequestSchema.safeParse(body.value);
  if (!input.success || request.signal.aborted) return fail("invalid_request");

  const admission = reserveRevision(config);
  if (admission.result === "limited") return fail("usage_limited", admission.retryAfter);
  if (admission.result === "store_unavailable") return fail("ai_unavailable");

  try {
    const interpretation = await interpretRevision(config, input.data, request.signal);
    if (interpretation.kind === "timeout") return fail("provider_timeout");
    if (interpretation.kind === "invalid") return fail("provider_response_invalid");
    if (interpretation.kind === "unavailable") return fail("ai_unavailable");
    if (interpretation.kind === "success") return reply(interpretation.result, 200, interpretation.result.outcome);
    return fail("ai_unavailable");
  } finally {
    admission.release();
  }
}
