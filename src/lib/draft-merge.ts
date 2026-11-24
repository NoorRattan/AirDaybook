import type { Draft } from "./draft-schema";
import { preferenceKeys } from "./preferences";

export function sameDraftValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aFields = a as Record<string, unknown>;
  const bFields = b as Record<string, unknown>;
  const keys = Object.keys(aFields);
  return keys.length === Object.keys(bFields).length &&
    keys.every((key) => Object.hasOwn(bFields, key) && sameDraftValue(aFields[key], bFields[key]));
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
    routine: sameDraftValue(previous.routine, next.routine) ? saved.routine : next.routine,
  };
}
