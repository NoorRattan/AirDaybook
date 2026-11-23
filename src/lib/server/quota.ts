import "server-only";
import { DatabaseSync } from "node:sqlite";
import type { AIConfiguration } from "./ai-config";

const dateInIndia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});
const windowMs = 60_000;
const dayMs = 24 * 60 * windowMs;

let store: { path: string; database: DatabaseSync; cleanedDay?: string } | undefined;
let inFlight = 0;
const recentAdmissions: number[] = [];

function openStore(path: string) {
  if (store?.path === path) return store;
  const database = new DatabaseSync(path, { timeout: 250 });
  try {
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK (used > 0))");
  } catch (error) {
    database.close();
    throw error;
  }
  store?.database.close();
  store = { path, database };
  return store;
}

export type Admission =
  | { result: "reserved"; release: () => void | Promise<void> }
  | { result: "limited"; retryAfter: number; category: "concurrency_limit" | "burst_limit" | "daily_limit" }
  | { result: "store_unavailable" };

export async function reserveRevision(config: AIConfiguration, signal: AbortSignal): Promise<Admission> {
  if (config.storage.kind === "postgres") {
    try {
      const { reservePostgres } = await import("./quota-postgres");
      return await reservePostgres(config, config.storage, signal);
    } catch {
      return { result: "store_unavailable" };
    }
  }
  if (signal.aborted) return { result: "store_unavailable" };
  return reserveSqlite(config, config.storage.path, Date.now());
}

function reserveSqlite(config: AIConfiguration, path: string, now: number): Admission {
  while (recentAdmissions.length > 0 && recentAdmissions[0] <= now - windowMs) recentAdmissions.shift();
  if (inFlight >= config.maxConcurrent) return { result: "limited", retryAfter: 1, category: "concurrency_limit" };
  if (recentAdmissions.length >= config.perMinute) {
    return { result: "limited", category: "burst_limit", retryAfter: Math.max(1, Math.ceil((recentAdmissions[0] + windowMs - now) / 1000)) };
  }

  try {
    const day = dateInIndia.format(now);
    const active = openStore(path);
    if (active.cleanedDay !== day) {
      const cutoff = dateInIndia.format(now - 6 * dayMs);
      active.database.prepare("DELETE FROM daily_usage WHERE day < ?").run(cutoff);
      active.cleanedDay = day;
    }
    const slot = active.database.prepare(
      "INSERT INTO daily_usage(day, used) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET used = daily_usage.used + 1 " +
      "WHERE daily_usage.used < ? RETURNING used",
    ).get(day, config.dailyLimit);
    if (!slot) {
      const nextMidnight = Date.parse(`${day}T00:00:00+05:30`) + dayMs;
      return { result: "limited", category: "daily_limit", retryAfter: Math.max(1, Math.ceil((nextMidnight - now) / 1000)) };
    }
  } catch {
    return { result: "store_unavailable" };
  }

  recentAdmissions.push(now);
  inFlight++;
  let released = false;
  return {
    result: "reserved",
    release: () => {
      if (released) return;
      released = true;
      inFlight--;
    },
  };
}
