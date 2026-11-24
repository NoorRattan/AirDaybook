import "server-only";
import { isAbsolute } from "node:path";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function boundedSetting(name: string, min: number, max: number, fallback?: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : undefined;
}

function canonicalOrigin() {
  const productionDomain = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  const configured = process.env.APP_ORIGIN?.trim() || (productionDomain ? `https://${productionDomain}` : undefined);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const loopback = loopbackHosts.has(url.hostname);
    return url.origin === configured && (url.protocol === "https:" || (loopback && url.protocol === "http:"))
      ? url.origin : null;
  } catch {
    return null;
  }
}

function quotaStore() {
  const connection = (process.env.AI_QUOTA_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL)?.trim();
  if (connection) {
    try {
      const url = new URL(connection);
      if (!(["postgres:", "postgresql:"].includes(url.protocol) && url.hostname && url.pathname.length > 1)) return null;
      const loopback = loopbackHosts.has(url.hostname);
      // The adapter supplies its own TLS policy. DSN query flags cannot override it.
      url.searchParams.delete("sslmode");
      url.searchParams.delete("ssl");
      url.searchParams.delete("channel_binding");
      return { kind: "postgres", url: url.href, tls: !loopback } as const;
    } catch {
      return null;
    }
  }
  if (process.env.VERCEL === "1") return null;
  const path = process.env.AI_QUOTA_DB_PATH?.trim();
  return path && isAbsolute(path) ? { kind: "sqlite", path } as const : null;
}

export function aiConfiguration() {
  const enabled = process.env.AI_ENABLED;
  if (enabled === undefined || enabled === "false") return { kind: "disabled" } as const;
  if (enabled !== "true") return { kind: "invalid" } as const;
  const origin = canonicalOrigin();
  const key = process.env.GROQ_API_KEY?.trim();
  const storage = quotaStore();
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const dailyLimit = boundedSetting("AI_DAILY_LIMIT", 1, 10000);
  const maxConcurrent = boundedSetting("AI_MAX_CONCURRENT", 1, 16);
  const perMinute = boundedSetting("AI_BURST_PER_MINUTE", 1, 120);
  const timeout = boundedSetting("AI_PROVIDER_TIMEOUT_MS", 1000, 25000, 8000);
  const edgeIdentity = process.env.VERCEL === "1";
  const clientDailyLimit = boundedSetting("AI_CLIENT_DAILY_LIMIT", 1, Math.max(1, (dailyLimit ?? 1) - 1),
    Math.max(1, Math.min(3, Math.floor((dailyLimit ?? 1) / 2))));
  const clientPerMinute = Math.max(1, Math.min(2, Math.floor((perMinute ?? 1) / 2)));

  if (!origin || !key || !storage ||
    !dailyLimit || !maxConcurrent || !perMinute || !timeout || !clientDailyLimit ||
    !/^[a-zA-Z0-9._/-]{1,100}$/.test(model) ||
    (!edgeIdentity && !loopbackHosts.has(new URL(origin).hostname))) return { kind: "invalid" } as const;

  return { kind: "ready", config: { origin, key, storage, model, dailyLimit, maxConcurrent, perMinute, timeout, edgeIdentity, clientDailyLimit, clientPerMinute } } as const;
}

export type AIConfiguration = Extract<ReturnType<typeof aiConfiguration>, { kind: "ready" }>["config"];
