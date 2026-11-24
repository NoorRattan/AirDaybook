import "server-only";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AIConfiguration } from "./ai-config";
import { quotaCutoff, quotaDay, quotaWindowMs, secondsUntilQuotaReset } from "./quota-time";

let store: { path: string; database: DatabaseSync; cleanedDay?: string } | undefined;

function openStore(path: string) {
  if (store?.path === path) return store;
  const database = new DatabaseSync(path, { timeout: 2000 });
  try {
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK (used > 0))");
    database.exec(`CREATE TABLE IF NOT EXISTS revision_leases (
      id TEXT PRIMARY KEY, admitted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`);
    database.exec("CREATE INDEX IF NOT EXISTS revision_leases_admitted ON revision_leases(admitted_at)");
    database.exec("CREATE INDEX IF NOT EXISTS revision_leases_expires ON revision_leases(expires_at)");
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
  | { result: "limited"; retryAfter: number; category: "concurrency_limit" | "burst_limit" | "daily_limit" | "client_limit" }
  | { result: "store_unavailable" }
  | { result: "aborted" };

export async function reserveRevision(config: AIConfiguration, signal: AbortSignal, identity: string | null): Promise<Admission> {
  if (signal.aborted) return { result: "aborted" };
  if (config.storage.kind === "postgres") {
    try {
      const { reservePostgres } = await import("./quota-postgres");
      return await reservePostgres(config, config.storage, signal, identity);
    } catch {
      return { result: signal.aborted ? "aborted" : "store_unavailable" };
    }
  }
  return reserveSqlite(config, config.storage.path);
}

function reserveSqlite(config: AIConfiguration, path: string): Admission {
  try {
    const active = openStore(path);
    const { database } = active;
    database.exec("BEGIN IMMEDIATE");
    try {
      const now = Date.now();
      const day = quotaDay(now);
      if (active.cleanedDay !== day) {
        database.prepare("DELETE FROM daily_usage WHERE day < ?").run(quotaCutoff(now));
      }
      const result = reserveSqliteSlot(config, database, path, now, day);
      database.exec("COMMIT");
      active.cleanedDay = day;
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } catch {
    return { result: "store_unavailable" };
  }
}

function reserveSqliteSlot(config: AIConfiguration, database: DatabaseSync, path: string, now: number, day: string): Admission {
  const windowStart = now - quotaWindowMs;
  database.prepare("DELETE FROM revision_leases WHERE admitted_at <= ? AND expires_at <= ?").run(windowStart, now);
  const inFlight = Number(database.prepare("SELECT count(*) AS count FROM revision_leases WHERE expires_at > ?").get(now)?.count);
  if (inFlight >= config.maxConcurrent) return { result: "limited", retryAfter: 1, category: "concurrency_limit" };
  const recent = database.prepare("SELECT count(*) AS count, min(admitted_at) AS first FROM revision_leases WHERE admitted_at > ?").get(windowStart);
  if (Number(recent?.count) >= config.perMinute) {
    return { result: "limited", category: "burst_limit", retryAfter: Math.max(1, Math.ceil((Number(recent?.first) + quotaWindowMs - now) / 1000)) };
  }
  const slot = database.prepare(`INSERT INTO daily_usage(day, used) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET used = daily_usage.used + 1 WHERE daily_usage.used < ? RETURNING used`).get(day, config.dailyLimit);
  if (!slot) return { result: "limited", category: "daily_limit", retryAfter: secondsUntilQuotaReset(day, now) };
  const id = randomUUID();
  database.prepare("INSERT INTO revision_leases VALUES (?, ?, ?)").run(id, now, now + config.timeout + 10_000);
  return {
    result: "reserved",
    release: () => {
      try {
        openStore(path).database.prepare("UPDATE revision_leases SET expires_at = min(expires_at, ?) WHERE id = ?").run(Date.now(), id);
      } catch {
        // The lease will expire even if the worker loses the connection.
      }
    },
  };
}
