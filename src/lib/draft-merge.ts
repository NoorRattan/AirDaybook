import type { Draft } from "./draft-schema";
import { preferenceKeys } from "./preferences";
import type { Routine } from "./routine";
import { maxRoutineBlocks } from "./routine-intake";

export function sameDraftValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aFields = a as Record<string, unknown>;
  const bFields = b as Record<string, unknown>;
  const keys = Object.keys(aFields);
  return keys.length === Object.keys(bFields).length &&
    keys.every((key) => Object.hasOwn(bFields, key) && sameDraftValue(aFields[key], bFields[key]));
}

const routineFlags = ["extraPrecautions", "solidFuel", "outdoorWork", "community"] as const;

function mergeRoutine(saved: Routine | null, previous: Routine | null, next: Routine | null) {
  if (sameDraftValue(previous, next)) return saved;
  if (sameDraftValue(previous, saved)) return next;

  const nextIds = new Set(next?.blocks.map(({ id }) => id));
  const previousIds = new Set(previous?.blocks.map(({ id }) => id));
  const blocks = (saved?.blocks ?? []).filter(({ id }) => !previousIds.has(id) || nextIds.has(id));
  const savedIds = new Set(blocks.map(({ id }) => id));
  for (const block of next?.blocks ?? []) {
    if (blocks.length >= maxRoutineBlocks) break;
    if (!previousIds.has(block.id) && !savedIds.has(block.id)) blocks.push(block);
  }

  const routine = { blocks, extraPrecautions: false, solidFuel: false, outdoorWork: false, community: false };
  for (const key of routineFlags) {
    const before = previous?.[key] ?? false;
    const after = next?.[key] ?? false;
    routine[key] = before === after ? saved?.[key] ?? false : after;
  }
  return blocks.length || routineFlags.some((key) => routine[key]) ? routine : null;
}

export function mergeDraftFields(saved: Draft, previous: Draft, next: Draft): Draft {
  const changedPreferences = preferenceKeys.filter((key) => previous.preferences[key] !== next.preferences[key]);
  const preferences = { ...saved.preferences };
  for (const key of changedPreferences) preferences[key] = next.preferences[key];

  return {
    version: 1,
    selection: sameDraftValue(previous.selection, next.selection) ? saved.selection : next.selection,
    plan: sameDraftValue(previous.plan, next.plan) ? saved.plan : next.plan,
    preferences,
    previousPreferences: changedPreferences.length ? saved.preferences : saved.previousPreferences,
    travel: sameDraftValue(previous.travel, next.travel) ? saved.travel : next.travel,
    routine: mergeRoutine(saved.routine, previous.routine, next.routine),
  };
}
