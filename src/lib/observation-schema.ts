import { z } from "zod";

const FIVE_MINUTES = 5 * 60 * 1000;
const label = z.string().trim().min(1, "Enter a name.").max(100);

function isHttpsLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isObservationTime(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second = "0"] = parts;
  const calendar = new Date(`${year}-${month}-01T00:00:00Z`);
  calendar.setUTCDate(Number(day));
  return calendar.getUTCMonth() + 1 === Number(month) &&
    Number(day) >= 1 && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
}

const averagingMinutes = z.number().int().positive().nullable();
const metricSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("aqi"),
    scale: z.enum(["india_naqi", "us_aqi", "unknown"]),
    basis: z.enum(["overall", "pollutant_subindex", "unknown"]),
    value: z.number().int().nonnegative(),
    averagingMinutes,
  }),
  z.strictObject({
    kind: z.literal("pm25"),
    unit: z.enum(["ug_m3", "mg_m3"]),
    value: z.number().nonnegative(),
    averagingMinutes,
  }),
]);

export const observationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  location: z.strictObject({ scope: z.enum(["city", "station"]), label }),
  source: z.strictObject({
    label,
    url: z.string().trim().max(500).refine(isHttpsLink, "Use an HTTPS source link without login details.").optional(),
  }),
  observedAt: z.string().refine(isObservationTime, "Use a valid date and time with an explicit offset."),
  metric: metricSchema,
}).superRefine(({ metric }, context) => {
  if (metric.kind === "aqi" && metric.scale === "india_naqi" && metric.value > 500) {
    context.addIssue({ code: "custom", path: ["metric", "value"], message: "Indian AQI must be between 0 and 500." });
  }
  if (metric.kind === "pm25" && metric.unit === "mg_m3" && !Number.isFinite(metric.value * 1000)) {
    context.addIssue({ code: "custom", path: ["metric", "value"], message: "PM₂.₅ is too large to convert to µg/m³." });
  }
});

export const userReadingSchema = z.strictObject({
  kind: z.enum(["manual", "import"]),
  observation: observationSchema,
});

export const selectionSchema = z.union([z.literal("replay"), userReadingSchema]).nullable();
export type ReadingSelection = z.infer<typeof selectionSchema>;
export type Observation = z.infer<typeof observationSchema>;

export function parseObservation(data: unknown, now = Date.now()): Observation {
  const result = observationSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new Error(field ? `${field}: ${issue.message}` : issue.message);
  }
  if (Date.parse(result.data.observedAt) - now > FIVE_MINUTES) {
    throw new Error("Enter a reading time that has already occurred.");
  }
  return result.data;
}
