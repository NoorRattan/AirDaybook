import { z } from "zod";
import { selectionSchema } from "./observation-schema";
import { emptyPreferences } from "./preferences";
import { preferencesSchema } from "./revision-schema";
import type { TravelComparison } from "./travel";

const wait = z.number().int().min(0).max(1440).nullable();
export const planSchema = z.strictObject({
  commitment: z.string().trim().min(1, "Enter a commitment.").max(100),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Enter a time."),
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

export type Plan = z.infer<typeof planSchema>;
export type Draft = z.infer<typeof draftSchema> & { travel: TravelComparison | null };
