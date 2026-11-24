import assert from "node:assert/strict";
import { test } from "node:test";
import { communityNote } from "../src/lib/community-share";
import { emptyDraft, hasSavedWorkspaceData } from "../src/lib/draft";
import { mergeDraftFields } from "../src/lib/draft-merge";
import { draftSchema, planSchema } from "../src/lib/draft-schema";
import { parseObservation, type Observation } from "../src/lib/observation-schema";
import { compareWaiting, displayPlanTime, initialPlan, parsePlan, parseWait } from "../src/lib/plan";
import { planningActions } from "../src/lib/planning-actions";
import { emptyPreferences } from "../src/lib/preferences";
import { indianAqiBand, isStaleObservation, observationTime, readingView } from "../src/lib/readings";
import { DELHI_REPLAY } from "../src/lib/replay";
import { interpretationToRevision, revisionRequestSchema, revisionResponseSchema } from "../src/lib/revision-schema";
import { metroSavings, tripTimes, type Trip } from "../src/lib/travel";
import { travelComparisonSchema } from "../src/lib/travel-schema";

const now = Date.parse("2026-11-24T08:00:00Z");
const baseReading: Observation = {
  schemaVersion: 1,
  location: { scope: "station", label: "Station for testing" },
  source: { label: "Reading source for testing", url: "https://example.com/reading" },
  observedAt: "2026-11-24T06:00:00Z",
  metric: { kind: "aqi", scale: "india_naqi", basis: "overall", value: 220, averagingMinutes: 1440 },
};
const aqi = (value: number, scale: "india_naqi" | "us_aqi" = "india_naqi", basis: "overall" | "pollutant_subindex" = "overall") => ({
  kind: "manual" as const,
  observation: { ...baseReading, metric: { kind: "aqi" as const, scale, basis, value, averagingMinutes: null } },
});
const fields = { commitment: " School pickup ", time: "15:00", previousWait: "15", revisedWait: "5" };
const pickup = { commitment: "School pickup", time: "15:00", previousWait: 15, revisedWait: 5 };
const road: Trip = { mode: "road", vehicle: "enclosed", traffic: "heavy", walking: 3, waiting: 9, outdoorWaiting: 8, riding: 35 };
const metro: Trip = { mode: "metro", vehicle: "enclosed", traffic: "light", walking: 9, waiting: 5, outdoorWaiting: 2, riding: 21 };
const compare = { current: road, alternative: metro, averageRoadBaseline: true, metroKm: 12 };

test("classifies every Indian AQI boundary and fails closed for invalid values", () => {
  const boundaries = [
    [0, "Good"], [50, "Good"], [51, "Satisfactory"], [100, "Satisfactory"], [101, "Moderate"],
    [200, "Moderate"], [201, "Poor"], [300, "Poor"], [301, "Very Poor"], [400, "Very Poor"],
    [401, "Severe"], [500, "Severe"], [-1, null], [501, null], [1.5, null], [NaN, null],
  ] as const;
  for (const [value, expected] of boundaries) assert.equal(indianAqiBand(value), expected, String(value));
});

test("keeps US AQI and pollutant sub-index out of Indian severity classification", () => {
  for (const value of [aqi(400, "us_aqi"), aqi(400, "india_naqi", "pollutant_subindex")]) {
    const view = readingView(value, now);
    assert.equal(view?.kind, "display-only");
    assert.equal(view.band, null);
  }
});

test("uses IST, the exact freshness boundary, and explicit PM2.5 unit conversion", () => {
  const observed = "2026-11-24T02:00:00Z";
  assert.equal(isStaleObservation(observed, now), false);
  assert.equal(isStaleObservation(observed, now + 1), true);
  assert.match(observationTime(observed), /7:30\s*am IST/i);
  const pm = { kind: "manual" as const, observation: {
    ...baseReading, observedAt: observed,
    metric: { kind: "pm25" as const, unit: "mg_m3" as const, value: 0.123, averagingMinutes: 60 },
  } };
  assert.equal(readingView(pm, now)?.normalization, "123 µg/m³ normalized");
  assert.equal(readingView(pm, now)?.kind, "display-only");
  assert.equal(readingView(pm, now + 1)?.kind, "stale");
});

test("rejects invalid calendar dates, future readings and unsupported Indian AQI counts", () => {
  assert.deepEqual(parseObservation(baseReading, now), baseReading);
  assert.throws(() => parseObservation({ ...baseReading, observedAt: "2026-02-30T09:00:00+05:30" }, now), /valid date/);
  assert.throws(() => parseObservation({ ...baseReading, observedAt: "2026-11-24T08:06:00Z" }, now), /already occurred/);
  assert.throws(() => parseObservation(aqi(501).observation, now), /between 0 and 500/);
});

test("accepts bounded whole waiting times and distinguishes missing, zero and malformed", () => {
  assert.deepEqual(parseWait(""), { kind: "empty", minutes: null });
  assert.deepEqual(parseWait("0"), { kind: "valid", minutes: 0 });
  assert.equal(parseWait("1440").minutes, 1440);
  for (const raw of ["1.5", "-1", "1441", "x"]) assert.equal(parseWait(raw).kind, "invalid");
  assert.deepEqual(parsePlan(fields), { plan: pickup });
  assert.equal(planSchema.safeParse(pickup).success, true);
  for (const changed of [
    { ...fields, commitment: "" }, { ...fields, commitment: "a".repeat(101) },
    { ...fields, time: "24:00" }, { ...fields, previousWait: "2.5" }, { ...fields, revisedWait: "-1" },
  ]) assert.equal("error" in parsePlan(changed), true);
});

test("compares waits on one scale without conflating missing or zero", () => {
  assert.deepEqual(compareWaiting(15, 5), { delta: 10, currentFraction: 1, revisedFraction: 1 / 3 });
  assert.equal(compareWaiting(0, 0).delta, 0);
  assert.equal(compareWaiting(0, 5).delta, -5);
  assert.equal(compareWaiting(null, 0).delta, null);
  assert.deepEqual(displayPlanTime("00:00"), { clock: "12:00", meridiem: "am" });
  assert.deepEqual(displayPlanTime("15:03"), { clock: "3:03", meridiem: "pm" });
});

test("replay presets a pickup only when the user has no saved commitment", () => {
  assert.equal(initialPlan(null, null), null);
  assert.equal(initialPlan(null, "replay")?.time, "15:00");
  const appointment = { ...pickup, commitment: "Appointment", time: "09:00" };
  assert.equal(initialPlan(appointment, "replay"), appointment);
});

test("tailors choices by fresh eligible AQI and keeps stale and historical context explicit", () => {
  const actions = (reading: ReturnType<typeof readingView>) => planningActions(emptyPreferences, reading, pickup);
  assert.equal(actions(readingView(aqi(200), now)).actions[0].area, "schedule");
  assert.equal(actions(readingView(aqi(201), now)).actions[0].area, "home");
  assert.match(actions(readingView(aqi(201), now)).context, /reports poor/i);
  assert.match(actions(readingView(aqi(382), now + 8 * 3600 * 1000)).context, /newer local reading/);
  assert.match(actions(readingView(aqi(382, "us_aqi"), now)).context, /general options/);
  assert.match(actions(readingView("replay", now)).context, /historical Delhi example/);
  assert.match(actions(null).context, /Add a local reading/);
  assert.match(actions(null).actions[0].description, /saves 10 min outside/);
});

test("honors indoor, purifier, Metro and errand availability without changing a plan", () => {
  const before = { ...pickup };
  const next = planningActions({ ...emptyPreferences, hasPurifier: true, metroAvailable: true, canMoveActivityIndoors: true }, null, pickup);
  assert.deepEqual(next.actions.map(({ area }) => area), ["schedule", "home", "home", "travel"]);
  assert.match(next.actions[0].title, /indoors/);
  assert.ok(next.actions.find(({ source }) => source?.label === "EPA air cleaner guidance"));
  assert.match(next.actions.at(-1)!.title, /Metro/);
  const combined = planningActions({ ...emptyPreferences, hasPurifier: false, canCombineErrands: true }, null, pickup);
  assert.match(combined.actions.at(-1)!.title, /Combine two/);
  const unavailable = planningActions({ ...emptyPreferences, metroAvailable: false, canCombineErrands: false }, null, pickup);
  assert.match(unavailable.actions.at(-1)!.title, /Compare two routes/);
  assert.equal(unavailable.actions.length, 3);
  assert.deepEqual(pickup, before);
});

test("shares consistent historical values and keeps user labels private by default", () => {
  for (const language of ["en", "hi"] as const) {
    const note = (selection: Parameters<typeof communityNote>[0]["selection"], includeLabels = false) =>
      communityNote({ selection, now, language, context: " ", action: " ", includeLabels });
    assert.match(note("replay"), new RegExp(String(DELHI_REPLAY.invocation.aqi)));
    assert.ok(note("replay").includes(DELHI_REPLAY.revocation.url));
    const manual = { kind: "manual" as const, observation: baseReading };
    assert.doesNotMatch(note(manual), /Station for testing|Reading source for testing|example\.com/);
    assert.match(note(manual, true), /Station for testing/);
    assert.match(note(manual, true), /Reading source for testing/);
    assert.doesNotMatch(note(null), /382/);
  }
});

test("merges changes from stale tabs without overwriting unrelated fields", () => {
  const saved = { ...emptyDraft, selection: "replay" as const, preferences: { ...emptyPreferences, hasPurifier: true } };
  const editing = { ...emptyDraft, plan: pickup, preferences: { ...emptyPreferences, metroAvailable: true } };
  const merged = mergeDraftFields(saved, emptyDraft, editing);
  assert.equal(merged.selection, "replay");
  assert.equal(merged.plan, pickup);
  assert.equal(merged.preferences.hasPurifier, true);
  assert.equal(merged.preferences.metroAvailable, true);
  assert.equal(merged.previousPreferences, saved.preferences);
  assert.deepEqual(draftSchema.parse({ version: 1, selection: null, plan: null }).preferences, emptyPreferences);
});

test("equivalent stale saves retain the newer schedule and routes", () => {
  const previous = { ...emptyDraft, plan: pickup, travel: compare };
  const saved = { ...previous, plan: { ...pickup, commitment: "Appointment" }, travel: { ...compare, metroKm: 9 } };
  const next = { ...previous, plan: { ...pickup }, travel: structuredClone(compare) };
  assert.deepEqual(mergeDraftFields(saved, previous, next), saved);
});

test("enables clearing current preferences even without an earlier preference snapshot", () => {
  assert.equal(hasSavedWorkspaceData(emptyDraft), false);
  for (const hasPurifier of [true, false]) {
    assert.equal(hasSavedWorkspaceData({ ...emptyDraft, preferences: { ...emptyPreferences, hasPurifier } }), true);
  }
});

test("compares routes and calculates the published 12 km Metro range only for eligible inputs", () => {
  assert.deepEqual(tripTimes(road), { total: 47, outdoors: 11 });
  assert.deepEqual(tripTimes({ ...road, walking: null }), { total: null, outdoors: null });
  assert.equal(travelComparisonSchema.safeParse({ ...compare, current: { ...road, outdoorWaiting: 10 } }).success, false);
  assert.equal(travelComparisonSchema.safeParse(compare).success, true);
  assert.deepEqual(metroSavings(compare)?.map(({ kg }) => kg.toFixed(2)), ["0.29", "0.39"]);
  assert.equal(metroSavings({ ...compare, averageRoadBaseline: false }), null);
  assert.equal(metroSavings({ ...compare, alternative: road }), null);
  assert.equal(metroSavings({ ...compare, metroKm: null }), null);
});

test("the model can only propose confirmed preference edits and cannot rewrite the reading or schedule", () => {
  const request = revisionRequestSchema.parse({ revisionId: "unit", text: "Metro is available.", preferences: emptyPreferences });
  const choices = { hasPurifier: "unchanged", metroAvailable: "enable", canMoveActivityIndoors: "unchanged", canCombineErrands: "unchanged" };
  const result = interpretationToRevision({ outcome: "apply", preferences: choices }, request);
  assert.deepEqual(result, { revisionId: "unit", outcome: "apply", changes: { metroAvailable: true } });
  assert.equal(interpretationToRevision({ outcome: "apply", preferences: { ...choices, pickup: "16:00" } }, request), null);
  assert.equal(interpretationToRevision({ outcome: "clarify", preferences: choices }, request), null);
  assert.equal(interpretationToRevision({ outcome: "apply", preferences: choices }, { ...request, preferences: { ...emptyPreferences, metroAvailable: true } })?.outcome, "no_change");
  assert.equal(revisionResponseSchema.safeParse({ revisionId: "unit", outcome: "apply", changes: {} }).success, false);
  assert.equal(revisionRequestSchema.safeParse({ ...request, text: "a".repeat(501) }).success, false);
});
