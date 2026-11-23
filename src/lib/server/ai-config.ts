import "server-only";
import { isAbsolute } from "node:path";

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
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
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
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
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

  if (!origin || !key || !storage ||
    !dailyLimit || !maxConcurrent || !perMinute || !timeout) return { kind: "invalid" } as const;

  return { kind: "ready", config: { origin, key, storage, model, dailyLimit, maxConcurrent, perMinute, timeout } } as const;
}

export type AIConfiguration = Extract<ReturnType<typeof aiConfiguration>, { kind: "ready" }>["config"];
