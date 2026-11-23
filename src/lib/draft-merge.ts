import type { Draft } from "./draft-schema";
import { preferenceKeys } from "./preferences";

export function mergeDraftFields(saved: Draft, previous: Draft, next: Draft): Draft {
  const changedPreferences = preferenceKeys.filter((key) => previous.preferences[key] !== next.preferences[key]);
  const preferences = { ...saved.preferences };
  for (const key of changedPreferences) preferences[key] = next.preferences[key];

  return {
    version: 1,
    selection: previous.selection === next.selection ? saved.selection : next.selection,
    plan: previous.plan === next.plan ? saved.plan : next.plan,
    preferences,
    previousPreferences: changedPreferences.length ? saved.preferences : saved.previousPreferences,
    travel: previous.travel === next.travel ? saved.travel : next.travel,
  };
}
