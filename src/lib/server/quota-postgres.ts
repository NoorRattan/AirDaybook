import "server-only";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { AIConfiguration } from "./ai-config";
import type { Admission } from "./quota";
import { quotaDay, secondsUntilQuotaReset } from "./quota-time";

type Store = Extract<AIConfiguration["storage"], { kind: "postgres" }>;
const lockId = 1746904451;
let opened: { url: string; client: ReturnType<typeof postgres>; ready: Promise<unknown>; cleanedDay?: string } | undefined;

async function setTransactionLimits(transaction: postgres.TransactionSql) {
  await transaction`SELECT set_config('statement_timeout', '4500', true),
    set_config('lock_timeout', '3000', true), set_config('idle_in_transaction_session_timeout', '6000', true)`;
}

function openStore(store: Store): NonNullable<typeof opened> {
  if (opened?.url === store.url) return opened;
  const previous = opened;
  const client = postgres(store.url, {
    max: 2, prepare: false, connect_timeout: 5, idle_timeout: 8,
    ssl: store.tls ? { rejectUnauthorized: true } : false,
    onnotice: () => {},
  });
  const instance = { url: store.url, client, ready: client.begin(async (transaction) => {
    await setTransactionLimits(transaction);
    await transaction`SELECT pg_advisory_xact_lock(${lockId})`;
    await transaction`CREATE TABLE IF NOT EXISTS airdaybook_quota_days (
      day date PRIMARY KEY, used integer NOT NULL CHECK (used > 0)
    )`;
    await transaction`CREATE TABLE IF NOT EXISTS airdaybook_quota_leases (
      id uuid PRIMARY KEY, admitted_at timestamptz NOT NULL, expires_at timestamptz NOT NULL
    )`;
    await transaction`ALTER TABLE airdaybook_quota_leases ADD COLUMN IF NOT EXISTS client text`;
    await transaction`CREATE INDEX IF NOT EXISTS airdaybook_quota_leases_admitted_idx ON airdaybook_quota_leases(admitted_at)`;
    await transaction`CREATE INDEX IF NOT EXISTS airdaybook_quota_leases_expires_idx ON airdaybook_quota_leases(expires_at)`;
    await transaction`CREATE INDEX IF NOT EXISTS airdaybook_quota_leases_client_idx ON airdaybook_quota_leases(client, admitted_at) WHERE client IS NOT NULL`;
    await transaction`CREATE TABLE IF NOT EXISTS airdaybook_quota_clients (
      day date NOT NULL, client text NOT NULL, used integer NOT NULL CHECK (used > 0), PRIMARY KEY (day, client)
    )`;
  }) };
  opened = instance;
  void previous?.client.end({ timeout: 5 }).catch(() => {});
  void instance.ready.catch(() => {
    if (opened === instance) opened = undefined;
    void client.end({ timeout: 1 }).catch(() => {});
  });
  return instance;
}

export async function reservePostgres(config: AIConfiguration, store: Store, signal: AbortSignal, identity: string | null): Promise<Admission> {
  if (signal.aborted) return { result: "aborted" };
  const instance = openStore(store);
  const { client, ready } = instance;
  await ready;
  const lease = randomUUID();
  let cleanedDay: string | undefined;
  const admission = await client.begin(async (transaction): Promise<Admission> => {
    await setTransactionLimits(transaction);
    await transaction`SELECT pg_advisory_xact_lock(${lockId})`;
    if (signal.aborted) return { result: "aborted" };
    const [{ now }] = await transaction<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const day = quotaDay(+now);
    if (instance.cleanedDay !== day) {
      await transaction`DELETE FROM airdaybook_quota_days WHERE day < ${day}::date - 6`;
      // Discard client identifiers at the next daily boundary.
      await transaction`DELETE FROM airdaybook_quota_clients WHERE day < ${day}::date`;
      cleanedDay = day;
    }
    await transaction`DELETE FROM airdaybook_quota_leases
      WHERE admitted_at <= ${now}::timestamptz - interval '1 minute' AND expires_at <= ${now}`;
    const [{ in_flight, recent, retry_after }] = await transaction<{ in_flight: number; recent: number; retry_after: number | null }[]>`
      SELECT (count(*) FILTER (WHERE expires_at > ${now}))::int AS in_flight,
        (count(*) FILTER (WHERE admitted_at > ${now}::timestamptz - interval '1 minute'))::int AS recent,
        ceil(extract(epoch FROM (min(admitted_at) FILTER (WHERE admitted_at > ${now}::timestamptz - interval '1 minute')
          + interval '1 minute' - ${now}::timestamptz)))::int AS retry_after
      FROM airdaybook_quota_leases
      WHERE expires_at > ${now} OR admitted_at > ${now}::timestamptz - interval '1 minute'`;
    if (in_flight >= config.maxConcurrent) return { result: "limited", category: "concurrency_limit", retryAfter: 1 };
    if (recent >= config.perMinute) return { result: "limited", category: "burst_limit", retryAfter: Math.max(1, retry_after ?? 60) };

    if (identity) {
      const [usage] = await transaction<{ used: number }[]>`SELECT used FROM airdaybook_quota_clients WHERE day = ${day} AND client = ${identity}`;
      if (usage && usage.used >= config.clientDailyLimit) {
        return { result: "limited", category: "client_limit", retryAfter: secondsUntilQuotaReset(day, +now) };
      }
      const [{ recent, retry_after }] = await transaction<{ recent: number; retry_after: number | null }[]>`
        SELECT count(*)::int AS recent,
          ceil(extract(epoch FROM min(admitted_at) + interval '1 minute' - ${now}::timestamptz))::int AS retry_after
        FROM airdaybook_quota_leases
        WHERE client = ${identity} AND admitted_at > ${now}::timestamptz - interval '1 minute'`;
      if (recent >= config.clientPerMinute) {
        return { result: "limited", category: "client_limit", retryAfter: Math.max(1, retry_after ?? 60) };
      }
    }
    if (signal.aborted) return { result: "aborted" };
    const [reserved] = await transaction`INSERT INTO airdaybook_quota_days(day, used) VALUES (${day}, 1)
      ON CONFLICT(day) DO UPDATE SET used = airdaybook_quota_days.used + 1
      WHERE airdaybook_quota_days.used < ${config.dailyLimit} RETURNING used`;
    if (!reserved) {
      return { result: "limited", category: "daily_limit", retryAfter: secondsUntilQuotaReset(day, +now) };
    }
    if (identity) {
      await transaction`INSERT INTO airdaybook_quota_clients(day, client, used) VALUES (${day}, ${identity}, 1)
        ON CONFLICT(day, client) DO UPDATE SET used = airdaybook_quota_clients.used + 1`;
    }

    const expiresAt = new Date(+now + config.timeout + 10_000);
    await transaction`INSERT INTO airdaybook_quota_leases(id, admitted_at, expires_at, client) VALUES (${lease}, ${now}, ${expiresAt}, ${identity})`;
    return { result: "reserved", async release() {
      try {
        await client.begin(async (transaction) => {
          await setTransactionLimits(transaction);
          await transaction`UPDATE airdaybook_quota_leases SET expires_at = LEAST(expires_at, clock_timestamp()) WHERE id = ${lease}`;
        });
      } catch {
        // An interrupted instance leaves a short-lived lease. Admission still fails closed.
      }
    } };
  });
  if (cleanedDay) instance.cleanedDay = cleanedDay;
  return admission;
}
