import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { readDraft, writeDraft, emptyDraft } from "../src/lib/draft";
import { clientQuotaKey } from "../src/lib/server/quota-identity";
import { quotaDay, secondsUntilQuotaReset } from "../src/lib/server/quota-time";
import { containsContactDetails, sourceHostname } from "../src/lib/input-text";
import { emptyRoutine, particleAirflow, routineAdvice } from "../src/lib/routine";
import { readingView } from "../src/lib/readings";
import { passengerGrams } from "../src/lib/travel";

test("IndexedDB preserves legacy data and atomically merges a routine and a stale schedule", async () => {
  const open = indexedDB.open("airdaybook", 1);
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    open.onupgradeneeded = () => open.result.createObjectStore("workspace");
    open.onsuccess = () => resolve(open.result);
    open.onerror = reject;
  });
  await new Promise<void>((resolve, reject) => {
    const tx = legacy.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put({ version: 1, selection: "replay", plan: null }, "draft");
    tx.oncomplete = () => resolve();
    tx.onabort = reject;
  });
  legacy.close();
  const old = await readDraft();
  assert.equal(old.selection, "replay");
  assert.equal(old.routine, null);
  const routine = { ...emptyRoutine, extraPrecautions: true };
  const plan = { commitment: "Pickup", time: "15:00", previousWait: 10, revisedWait: 5 };
  await Promise.all([writeDraft(old, { ...old, plan }), writeDraft(old, { ...old, routine })]);
  assert.deepEqual(await readDraft(), { ...old, plan, routine });
  await writeDraft(await readDraft(), emptyDraft);
  assert.deepEqual(await readDraft(), emptyDraft);
});

test("routine advice preserves fixed blocks and suppresses moves without a supported reading", () => {
  const fixed = { id: "fixed", name: "Pickup", time: "15:00", minutes: 15, fixed: true, outdoors: true, strenuous: false };
  const flexible = { ...fixed, id: "run", name: "Run", minutes: 30, fixed: false, strenuous: true };
  const routine = { ...emptyRoutine, blocks: [fixed, flexible] };
  const replay = routineAdvice(routine, readingView("replay", 0), true, "en");
  assert.deepEqual(replay.blocks.map(({ moveInside }) => moveInside), [false, true]);
  assert.equal(replay.removedMinutes, 30);
  assert.equal(replay.strenuousMinutes, 30);
  assert.equal(routineAdvice(routine, null, true, "en").removedMinutes, 0);
  assert.equal(particleAirflow(20, 2.5, 5), 250);
  assert.equal(particleAirflow(Infinity, 2.5, 5), null);
});

test("quota identifiers normalize valid ingress addresses and reject ambiguous headers", () => {
  const quota = (value: string | null) => clientQuotaKey(value, "fixture-key");
  assert.match(quota("192.0.2.10") ?? "", /^[a-f0-9]{64}$/);
  assert.equal(quota("192.0.2.10"), quota("::ffff:192.0.2.10"));
  assert.equal(quota("2001:db8:abcd:1234::1"), quota("2001:0db8:abcd:1234:9::20"));
  assert.notEqual(quota("2001:db8:abcd:1234::1"), quota("2001:db8:abcd:1235::1"));
  assert.equal(quota("192.0.2.10, 198.51.100.10"), null);
  assert.equal(quota("fe80::1%scope"), null);
  assert.equal(quota(null), null);
  const now = Date.parse("2026-11-24T18:29:59Z");
  assert.equal(quotaDay(now), "2026-11-24");
  assert.equal(secondsUntilQuotaReset(quotaDay(now), now), 1);
  assert.equal(quotaDay(now + 1000), "2026-11-25");
});

test("import links reject private aliases and plain-text AI updates detect common identifiers", () => {
  for (const url of ["https://127.1", "https://0x7f000001", "https://[::1]", "https://localhost.", "https://router.home.arpa", "https://xn--pypal-4ve.com"]) {
    assert.equal(sourceHostname(url), null, url);
  }
  assert.equal(sourceHostname("https://Example.com/report"), "example.com");
  for (const body of ["me@example.com", "९८७६५४३२१०", "1234 5678 9012"]) assert(containsContactDetails(body));
  assert.equal(containsContactDetails("Pickup at 15:00 and travel 12 km."), false);
});

test("tailpipe calculations allocate vehicle factors across actual riders", () => {
  assert.equal(passengerGrams("3.2", "12", "4"), 9.600000000000001);
  assert.equal(passengerGrams("0", "12", "4"), 0);
  assert.equal(passengerGrams("", "12", "4"), null);
  assert.equal(passengerGrams("3.2", "12", "0"), null);
});
