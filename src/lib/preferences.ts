export const preferenceKeys = [
  "hasPurifier",
  "metroAvailable",
  "canMoveActivityIndoors",
  "canCombineErrands",
] as const;

export type PreferenceKey = (typeof preferenceKeys)[number];
export type Preferences = Record<PreferenceKey, boolean | null>;
export type PreferenceChanges = Partial<Record<PreferenceKey, boolean>>;

export const emptyPreferences: Preferences = {
  hasPurifier: null,
  metroAvailable: null,
  canMoveActivityIndoors: null,
  canCombineErrands: null,
};

export const preferenceLabels: Record<PreferenceKey, string> = {
  hasPurifier: "Air purifier available",
  metroAvailable: "Metro available",
  canMoveActivityIndoors: "Activity can move indoors",
  canCombineErrands: "Errands can be combined",
};

export function preferenceLabel(value: boolean | null) {
  return value === null ? "Not set" : value ? "Yes" : "No";
}
