import { z } from "zod/v4-mini";
import { safeLabel, sourceHostname } from "./input-text";

const FIVE_MINUTES = 5 * 60 * 1000;
const label = z.string().check(z.trim(), z.minLength(1, "Enter a name."), z.maxLength(100));

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

const averagingMinutes = z.nullable(z.number().check(z.int(), z.positive()));
const metricSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("aqi"),
    scale: z.enum(["india_naqi", "us_aqi", "unknown"]),
    basis: z.enum(["overall", "pollutant_subindex", "unknown"]),
    value: z.number().check(z.int(), z.nonnegative()),
    averagingMinutes,
  }),
  z.strictObject({
    kind: z.literal("pm25"),
    unit: z.enum(["ug_m3", "mg_m3"]),
    value: z.number().check(z.nonnegative()),
    averagingMinutes,
  }),
]);

export const observationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  location: z.strictObject({ scope: z.enum(["city", "station"]), label }),
  source: z.strictObject({
    label,
    url: z.optional(z.string().check(z.trim(), z.maxLength(500), z.refine(isHttpsLink, "Use an HTTPS source link without login details."))),
  }),
  observedAt: z.string().check(z.refine(isObservationTime, "Use a valid date and time with an explicit offset.")),
  metric: metricSchema,
}).check(z.superRefine(({ metric }, context) => {
  if (metric.kind === "aqi" && metric.scale === "india_naqi" && metric.value > 500) {
    context.addIssue({ code: "custom", path: ["metric", "value"], message: "Indian AQI must be between 0 and 500." });
  }
  if (metric.kind === "pm25" && metric.unit === "mg_m3" && !Number.isFinite(metric.value * 1000)) {
    context.addIssue({ code: "custom", path: ["metric", "value"], message: "PM₂.₅ is too large to convert to µg/m³." });
  }
}));

export const userReadingSchema = z.strictObject({
  kind: z.enum(["manual", "import"]),
  observation: observationSchema,
});

export const selectionSchema = z.nullable(z.union([z.literal("replay"), userReadingSchema]));
export type ReadingSelection = z.infer<typeof selectionSchema>;
export type Observation = z.infer<typeof observationSchema>;

const observationFields = new Map([
  ["location.label", { field: "location", message: "Enter a city or station name of 1–100 characters." }],
  ["location.scope", { field: "scope", message: "Choose whether the reading covers a city or a station." }],
  ["source.label", { field: "source", message: "Enter a source name of 1–100 characters." }],
  ["source.url", { field: "sourceUrl", message: "Use an HTTPS source link without login details, up to 500 characters." }],
  ["observedAt", { field: "observedAt", message: "Use a valid date and time with an explicit UTC offset." }],
  ["metric.kind", { field: "kind", message: "Choose AQI or PM₂.₅ as the metric." }],
  ["metric.scale", { field: "scale", message: "Choose the AQI scale or select Unknown." }],
  ["metric.basis", { field: "basis", message: "Choose the AQI basis or select Unknown." }],
  ["metric.unit", { field: "unit", message: "Choose the unit reported by your source." }],
  ["metric.value", { field: "value", message: "Enter a non-negative value. Use a whole number for AQI." }],
  ["metric.averagingMinutes", { field: "averaging", message: "Enter a positive whole number of averaging minutes or leave it blank." }],
  ["schemaVersion", { field: null, message: "The file must use AirDaybook reading format version 1." }],
]);

export function validateObservation(data: unknown, now = Date.now()):
  { observation: Observation } | { field: string | null; message: string } {
  const result = observationSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const match = observationFields.get(issue.path.join("."));
    if (match) return issue.code === "custom" ? { ...match, message: issue.message } : match;
    return { field: null, message: "Use the AirDaybook reading format with a location, source, time and metric." };
  }
  if (Date.parse(result.data.observedAt) - now > FIVE_MINUTES) {
    return { field: "observedAt", message: "Enter a reading time that has already occurred." };
  }
  if (!safeLabel(result.data.location.label)) return { field: "location", message: "Remove invisible control characters from the city or station name." };
  if (!safeLabel(result.data.source.label)) return { field: "source", message: "Remove invisible control characters from the source name." };
  if (result.data.source.url && !sourceHostname(result.data.source.url)) {
    return { field: "sourceUrl", message: "Use a public HTTPS source link with a standard domain name." };
  }
  return { observation: result.data };
}

export function parseObservation(data: unknown, now = Date.now()): Observation {
  const result = validateObservation(data, now);
  if ("message" in result) throw new Error(result.message);
  return result.observation;
}
