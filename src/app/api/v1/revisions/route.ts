import { randomUUID } from "node:crypto";
import { revisionRequestSchema } from "@/lib/revision-schema";
import { aiConfiguration } from "@/lib/server/ai-config";
import { readBoundedJson } from "@/lib/server/bounded-json";
import { interpretRevision } from "@/lib/server/groq-revisions";
import { releaseId } from "@/lib/server/operations";
import { reserveRevision } from "@/lib/server/quota";
import { clientQuotaKey } from "@/lib/server/quota-identity";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  client_aborted: 499,
} as const;
type ErrorCode = keyof typeof errors;
type Failure = { retryAfter?: number; category?: string; upstreamStatus?: number };

export function GET() {
  return Response.json({ available: aiConfiguration().kind === "ready" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = randomUUID();

  function reply(body: unknown, status: number, outcome: string, { retryAfter, category, upstreamStatus }: Failure = {}) {
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (retryAfter !== undefined) headers.set("Retry-After", String(retryAfter));
    console.info(JSON.stringify({
      event: "plan_revision", requestId, release: releaseId(),
      status, outcome, elapsedMs: Date.now() - started, category, upstreamStatus,
    }));
    return Response.json(body, { status, headers });
  }

  function fail(code: ErrorCode, details?: Failure) {
    return reply({ error: { code }, requestId }, errors[code], code, details);
  }

  const configuration = aiConfiguration();
  if (configuration.kind !== "ready") {
    return fail("ai_unavailable", { category: configuration.kind === "disabled" ? "ai_disabled" : "configuration_invalid" });
  }
  const { config } = configuration;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== config.origin || (fetchSite && fetchSite !== "same-origin")) {
    return fail("origin_denied");
  }
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") return fail("unsupported_media_type");
  const body = await readBoundedJson(request, bodyLimit, AbortSignal.any([request.signal, AbortSignal.timeout(4000)]));
  if (request.signal.aborted) return fail("client_aborted");
  if (body.kind === "too_large") return fail("payload_too_large");
  if (body.kind !== "success") return fail("invalid_request");
  const input = revisionRequestSchema.safeParse(body.value);
  if (request.signal.aborted) return fail("client_aborted");
  if (!input.success) return fail("invalid_request");

  // Only Vercel's authenticated ingress supplies client identity. Local runs ignore headers.
  const client = config.edgeIdentity ? clientQuotaKey(request.headers.get("x-vercel-forwarded-for"), config.key) : null;
  if (config.edgeIdentity && !client) return fail("ai_unavailable", { category: "client_identity_unavailable" });
  const admission = await reserveRevision(config, request.signal, client);
  if (admission.result === "aborted") return fail("client_aborted");
  if (admission.result === "limited") return fail("usage_limited", { retryAfter: admission.retryAfter, category: admission.category });
  if (admission.result === "store_unavailable") return fail("ai_unavailable", { category: "quota_store_unavailable" });

  try {
    const interpretation = await interpretRevision(config, input.data, request.signal);
    if (interpretation.kind === "timeout") return fail("provider_timeout");
    if (interpretation.kind === "client_aborted") return fail("client_aborted");
    if (interpretation.kind === "invalid") return fail("provider_response_invalid");
    if (interpretation.kind === "success") return reply(interpretation.result, 200, interpretation.result.outcome);
    if (interpretation.kind === "provider_http_error") {
      return fail("ai_unavailable", { category: interpretation.kind, upstreamStatus: interpretation.status });
    }
    return fail("ai_unavailable", { category: interpretation.kind });
  } finally {
    await admission.release();
  }
}
