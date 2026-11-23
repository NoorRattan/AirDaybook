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
  const configured = process.env.APP_ORIGIN?.trim();
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

export function aiConfiguration() {
  const enabled = process.env.AI_ENABLED;
  if (enabled === undefined || enabled === "false") return { kind: "disabled" } as const;
  if (enabled !== "true") return { kind: "invalid" } as const;
  const origin = canonicalOrigin();
  const key = process.env.GROQ_API_KEY?.trim();
  const quotaPath = process.env.AI_QUOTA_DB_PATH?.trim();
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const dailyLimit = boundedSetting("AI_DAILY_LIMIT", 1, 10000);
  const maxConcurrent = boundedSetting("AI_MAX_CONCURRENT", 1, 16);
  const perMinute = boundedSetting("AI_BURST_PER_MINUTE", 1, 120);
  const timeout = boundedSetting("AI_PROVIDER_TIMEOUT_MS", 1000, 25000, 8000);

  if (!origin || !key || !quotaPath || !isAbsolute(quotaPath) ||
    !dailyLimit || !maxConcurrent || !perMinute || !timeout) return { kind: "invalid" } as const;

  return { kind: "ready", config: { origin, key, quotaPath, model, dailyLimit, maxConcurrent, perMinute, timeout } } as const;
}

export type AIConfiguration = Extract<ReturnType<typeof aiConfiguration>, { kind: "ready" }>["config"];
