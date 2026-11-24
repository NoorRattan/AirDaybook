import { z } from "zod/v4-mini";
import { selectionSchema } from "./observation-schema";
import { MAX_COMMITMENT_LENGTH, MAX_WAIT_MINUTES, PLAN_TIME } from "./plan";
import { emptyPreferences } from "./preferences";
import { preferencesSchema } from "./revision-schema";
import type { TravelComparison } from "./travel";
import type { Routine } from "./routine";

const wait = z.nullable(z.number().check(z.int(), z.minimum(0), z.maximum(MAX_WAIT_MINUTES)));
export const planSchema = z.strictObject({
  commitment: z.string().check(z.trim(), z.minLength(1, "Enter a commitment."), z.maxLength(MAX_COMMITMENT_LENGTH)),
  time: z.string().check(z.regex(PLAN_TIME, "Enter a time.")),
  previousWait: wait,
  revisedWait: wait,
});

export const draftSchema = z.strictObject({
  version: z.literal(1),
  selection: selectionSchema,
  plan: z.nullable(planSchema),
  preferences: z._default(preferencesSchema, emptyPreferences),
  previousPreferences: z._default(z.nullable(preferencesSchema), null),
});

export type { Plan } from "./plan";
export type Draft = z.infer<typeof draftSchema> & { travel: TravelComparison | null; routine: Routine | null };
