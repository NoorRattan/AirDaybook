import "server-only";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { AIConfiguration } from "./ai-config";
import type { Admission } from "./quota";

type Store = Extract<AIConfiguration["storage"], { kind: "postgres" }>;
const dayInIndia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});
const lockId = 1746904451;
let opened: { url: string; client: ReturnType<typeof postgres>; ready: Promise<unknown> } | undefined;

async function setTransactionLimits(transaction: postgres.TransactionSql) {
  await transaction`SELECT set_config('statement_timeout', '4500', true),
    set_config('lock_timeout', '3000', true), set_config('idle_in_transaction_session_timeout', '6000', true)`;
}

function openStore(store: Store) {
  if (opened?.url === store.url) return opened;
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
  }) };
  opened = instance;
  void instance.ready.catch(() => {
    if (opened === instance) opened = undefined;
    void client.end({ timeout: 1 }).catch(() => {});
  });
  return instance;
}

export async function reservePostgres(config: AIConfiguration, store: Store, signal: AbortSignal): Promise<Admission> {
  if (signal.aborted) return { result: "store_unavailable" };
  const { client, ready } = openStore(store);
  await ready;
  const lease = randomUUID();
  return client.begin(async (transaction): Promise<Admission> => {
    await setTransactionLimits(transaction);
    await transaction`SELECT pg_advisory_xact_lock(${lockId})`;
    if (signal.aborted) return { result: "store_unavailable" };
    const [{ now }] = await transaction<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const day = dayInIndia.format(now);
    await transaction`DELETE FROM airdaybook_quota_days WHERE day < ${day}::date - 6`;
    await transaction`DELETE FROM airdaybook_quota_leases
      WHERE admitted_at <= ${now}::timestamptz - interval '1 minute' AND expires_at <= ${now}`;
    const [{ in_flight, recent, retry_after }] = await transaction<{ in_flight: number; recent: number; retry_after: number | null }[]>`
      SELECT (count(*) FILTER (WHERE expires_at > ${now}))::int AS in_flight,
        (count(*) FILTER (WHERE admitted_at > ${now}::timestamptz - interval '1 minute'))::int AS recent,
        ceil(extract(epoch FROM (min(admitted_at) FILTER (WHERE admitted_at > ${now}::timestamptz - interval '1 minute')
          + interval '1 minute' - ${now}::timestamptz)))::int AS retry_after
      FROM airdaybook_quota_leases`;
    if (in_flight >= config.maxConcurrent) return { result: "limited", category: "concurrency_limit", retryAfter: 1 };
    if (recent >= config.perMinute) return { result: "limited", category: "burst_limit", retryAfter: Math.max(1, retry_after ?? 60) };

    const [reserved] = await transaction`INSERT INTO airdaybook_quota_days(day, used) VALUES (${day}, 1)
      ON CONFLICT(day) DO UPDATE SET used = airdaybook_quota_days.used + 1
      WHERE airdaybook_quota_days.used < ${config.dailyLimit} RETURNING used`;
    if (!reserved) {
      const nextMidnight = Date.parse(`${day}T00:00:00+05:30`) + 86_400_000;
      return { result: "limited", category: "daily_limit", retryAfter: Math.max(1, Math.ceil((nextMidnight - +now) / 1000)) };
    }

    const expiresAt = new Date(+now + config.timeout + 10_000);
    await transaction`INSERT INTO airdaybook_quota_leases(id, admitted_at, expires_at) VALUES (${lease}, ${now}, ${expiresAt})`;
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
}
