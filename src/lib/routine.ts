import { z } from "zod/v4-mini";
import { PLAN_TIME } from "./plan";
import { safeLabel } from "./input-text";
import type { readingView } from "./readings";
import { maxRoutineBlocks } from "./routine-intake";

export const routineBlockSchema = z.strictObject({
  id: z.string().check(z.regex(/^[\w-]{1,64}$/)),
  name: z.string().check(z.trim(), z.minLength(1), z.maxLength(100), z.refine(safeLabel)),
  time: z.string().check(z.regex(PLAN_TIME)),
  minutes: z.number().check(z.int(), z.minimum(1), z.maximum(720)),
  fixed: z.boolean(),
  outdoors: z.boolean(),
  strenuous: z.boolean(),
});
export const routineSchema = z.strictObject({
  blocks: z.array(routineBlockSchema).check(z.maxLength(maxRoutineBlocks)),
  extraPrecautions: z.boolean(),
  solidFuel: z.boolean(),
  outdoorWork: z.boolean(),
  community: z.boolean(),
});
export type Routine = z.infer<typeof routineSchema>;
export type RoutineBlock = z.infer<typeof routineBlockSchema>;
export const emptyRoutine: Routine = {
  blocks: [], extraPrecautions: false, solidFuel: false, outdoorWork: false, community: false,
};

const outdoorGuidance = {
  Good: ["Keep your usual routine.", "अपनी सामान्य दिनचर्या जारी रखें।"],
  Satisfactory: ["Keep your usual routine.", "अपनी सामान्य दिनचर्या जारी रखें।"],
  Moderate: ["Shorten prolonged strenuous outdoor activity.", "बाहर लंबे समय तक की जाने वाली मेहनत कम करें।"],
  Poor: ["Move flexible strenuous activities indoors or postpone them.", "बाहर की वैकल्पिक मेहनत वाली गतिविधियाँ अंदर करें या टालें।"],
  "Very Poor": ["Move optional outdoor exercise indoors or postpone it.", "बाहर का वैकल्पिक व्यायाम अंदर करें या टालें।"],
  Severe: ["Avoid optional outdoor exercise and shorten avoidable time outside.", "बाहर के गैर-ज़रूरी व्यायाम से बचें और बाहर का समय कम करें।"],
} as const;

export function routineAdvice(routine: Routine, reading: ReturnType<typeof readingView>, indoorAvailable: boolean, lang: "en" | "hi") {
  const band = reading?.kind === "provided" || reading?.kind === "historical" ? reading.band : null;
  const high = band === "Poor" || band === "Very Poor" || band === "Severe";
  const moderate = band === "Moderate" || (band === "Satisfactory" && routine.extraPrecautions);
  const guidance = high && routine.extraPrecautions
    ? ["Keep necessary outings short and avoid heavy effort.", "ज़रूरी काम के लिए बाहर कम समय बिताएँ और भारी मेहनत से बचें।"]
    : moderate ? outdoorGuidance.Moderate
      : band ? outdoorGuidance[band] : ["Check a recent local reading before changing your routine.", "दिनचर्या बदलने से पहले हाल का स्थानीय माप देखें।"];
  const blocks = [...routine.blocks].sort((a, b) => a.time.localeCompare(b.time)).map((block) => {
    const moveInside = !block.fixed && block.outdoors && indoorAvailable && (high || (moderate && block.strenuous));
    return { ...block, moveInside };
  });
  const outdoorMinutes = blocks.reduce((sum, block) => sum + (block.outdoors ? block.minutes : 0), 0);
  const removedMinutes = blocks.reduce((sum, block) => sum + (block.moveInside ? block.minutes : 0), 0);
  const strenuousMinutes = blocks.reduce((sum, block) => sum + (block.moveInside && block.strenuous ? block.minutes : 0), 0);
  return { blocks, outdoorMinutes, removedMinutes, strenuousMinutes, guidance: guidance[lang === "hi" ? 1 : 0], high };
}

export function particleAirflow(areaM2: number, heightM: number, airChanges: number) {
  if (!(areaM2 > 0 && areaM2 <= 500 && heightM > 0 && heightM <= 20 && airChanges > 0 && airChanges <= 20)) return null;
  return Math.ceil(areaM2 * heightM * airChanges);
}
