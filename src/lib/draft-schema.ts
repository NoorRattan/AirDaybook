import { z } from "zod";
import { selectionSchema } from "./observation-schema";
import { MAX_COMMITMENT_LENGTH, MAX_WAIT_MINUTES, PLAN_TIME } from "./plan";
import { emptyPreferences } from "./preferences";
import { preferencesSchema } from "./revision-schema";
import type { TravelComparison } from "./travel";

const wait = z.number().int().min(0).max(MAX_WAIT_MINUTES).nullable();
export const planSchema = z.strictObject({
  commitment: z.string().trim().min(1, "Enter a commitment.").max(MAX_COMMITMENT_LENGTH),
  time: z.string().regex(PLAN_TIME, "Enter a time."),
  previousWait: wait,
  revisedWait: wait,
});

export const draftSchema = z.strictObject({
  version: z.literal(1),
  selection: selectionSchema,
  plan: planSchema.nullable(),
  preferences: preferencesSchema.default(emptyPreferences),
  previousPreferences: preferencesSchema.nullable().default(null),
});

export type { Plan } from "./plan";
export type Draft = z.infer<typeof draftSchema> & { travel: TravelComparison | null };
