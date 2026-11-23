import { z } from "zod";
import { preferenceKeys, type PreferenceChanges, type Preferences } from "./preferences";

const outcomes = ["apply", "clarify", "no_change"] as const;
const directives = ["enable", "disable", "unchanged"] as const;
const booleanFields = {
  hasPurifier: z.boolean(),
  metroAvailable: z.boolean(),
  canMoveActivityIndoors: z.boolean(),
  canCombineErrands: z.boolean(),
};

export const preferencesSchema = z.strictObject({
  hasPurifier: booleanFields.hasPurifier.nullable(),
  metroAvailable: booleanFields.metroAvailable.nullable(),
  canMoveActivityIndoors: booleanFields.canMoveActivityIndoors.nullable(),
  canCombineErrands: booleanFields.canCombineErrands.nullable(),
});

const revisionId = z.string().min(1).max(64);
export const revisionRequestSchema = z.strictObject({
  revisionId,
  text: z.string().trim().min(1).refine((text) => Array.from(text).length <= 500),
  preferences: preferencesSchema,
});
export type RevisionRequest = z.infer<typeof revisionRequestSchema>;

export const revisionResponseSchema = z.strictObject({
  revisionId,
  outcome: z.enum(outcomes),
  changes: z.strictObject(booleanFields).partial(),
}).refine(({ changes, outcome }) => (Object.keys(changes).length > 0) === (outcome === "apply"));
export type RevisionResponse = z.infer<typeof revisionResponseSchema>;

const modelResultSchema = z.strictObject({
  outcome: z.enum(outcomes),
  preferences: z.strictObject({
    hasPurifier: z.enum(directives),
    metroAvailable: z.enum(directives),
    canMoveActivityIndoors: z.enum(directives),
    canCombineErrands: z.enum(directives),
  }),
});

export const providerJsonSchema = z.toJSONSchema(modelResultSchema, { target: "draft-7" });

export function interpretationToRevision(data: unknown, request: RevisionRequest): RevisionResponse | null {
  const result = modelResultSchema.safeParse(data);
  if (!result.success) return null;
  const { outcome, preferences } = result.data;
  const submittedChanges = preferenceKeys.filter((key) => preferences[key] !== "unchanged");
  if ((submittedChanges.length > 0) !== (outcome === "apply")) return null;

  const changes: PreferenceChanges = {};
  for (const key of submittedChanges) {
    const newValue = preferences[key] === "enable";
    if (newValue !== request.preferences[key]) changes[key] = newValue;
  }
  return {
    revisionId: request.revisionId,
    outcome: outcome === "apply" && Object.keys(changes).length === 0 ? "no_change" : outcome,
    changes,
  };
}

export function hasEffectivePreferenceChanges(changes: PreferenceChanges, preferences: Preferences) {
  return preferenceKeys.some((key) => changes[key] !== undefined && changes[key] !== preferences[key]);
}
