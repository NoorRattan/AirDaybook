import { z } from "zod/v4-mini";
import { containsContactDetails, safeMultilineText } from "./input-text";
import { preferenceKeys, type PreferenceChanges, type Preferences } from "./preferences";

const outcomes = ["apply", "clarify", "no_change"] as const;
const directives = ["enable", "disable", "unchanged"] as const;
export const assistantTools = ["routine", "indoor", "routes", "community"] as const;
const tool = z.enum(assistantTools);
const booleanFields = {
  hasPurifier: z.boolean(),
  metroAvailable: z.boolean(),
  canMoveActivityIndoors: z.boolean(),
  canCombineErrands: z.boolean(),
};

export const preferencesSchema = z.strictObject({
  hasPurifier: z.nullable(booleanFields.hasPurifier),
  metroAvailable: z.nullable(booleanFields.metroAvailable),
  canMoveActivityIndoors: z.nullable(booleanFields.canMoveActivityIndoors),
  canCombineErrands: z.nullable(booleanFields.canCombineErrands),
});

const revisionId = z.string().check(z.regex(/^[a-zA-Z0-9_-]{1,64}$/));
export const revisionRequestSchema = z.strictObject({
  revisionId,
  text: z.string().check(z.refine(safeMultilineText), z.trim(),
    z.refine((text) => Array.from(text).length >= 1 && Array.from(text).length <= 500 && !containsContactDetails(text))),
  preferences: preferencesSchema,
  assistant: z.optional(z.literal(true)),
});
export type RevisionRequest = z.infer<typeof revisionRequestSchema>;

export const revisionResponseSchema = z.strictObject({
  revisionId,
  outcome: z.enum(outcomes),
  changes: z.partial(z.strictObject(booleanFields)),
  tool: z.optional(tool),
}).check(z.refine(({ changes, outcome, tool }) => Boolean(Object.keys(changes).length || tool) === (outcome === "apply")));
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

const assistantResultSchema = z.extend(modelResultSchema, { tool: z.nullable(tool) });
export function revisionModelSchema(assistant: boolean | undefined) {
  return z.toJSONSchema(assistant ? assistantResultSchema : modelResultSchema, { target: "draft-7" });
}

export function interpretationToRevision(data: unknown, request: RevisionRequest): RevisionResponse | null {
  const result = request.assistant ? assistantResultSchema.safeParse(data) : modelResultSchema.safeParse(data);
  if (!result.success) return null;
  const { outcome, preferences } = result.data;
  const focus = "tool" in result.data ? result.data.tool as (typeof assistantTools)[number] | null : null;
  const submittedChanges = preferenceKeys.filter((key) => preferences[key] !== "unchanged");
  if (Boolean(submittedChanges.length || focus) !== (outcome === "apply")) return null;

  const changes: PreferenceChanges = {};
  for (const key of submittedChanges) {
    const newValue = preferences[key] === "enable";
    if (newValue !== request.preferences[key]) changes[key] = newValue;
  }
  return {
    revisionId: request.revisionId,
    outcome: outcome === "apply" && Object.keys(changes).length === 0 && !focus ? "no_change" : outcome,
    changes,
    ...(focus ? { tool: focus } : {}),
  };
}

export function hasEffectivePreferenceChanges(changes: PreferenceChanges, preferences: Preferences) {
  return preferenceKeys.some((key) => changes[key] !== undefined && changes[key] !== preferences[key]);
}
