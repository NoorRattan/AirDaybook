import type { ReadingSelection } from "./observation-schema";
import { DELHI_REPLAY, replayDate } from "./replay";
import { sourceHostname } from "./input-text";
import { estimateSource } from "./city-estimates";
export type { Observation, ReadingSelection } from "./observation-schema";

export const SOURCES = {
  cpcb: "https://airquality.cpcb.gov.in/AQI_India/",
  indoor: "https://ncdc.mohfw.gov.in/uploads/pdf/Enclosure%201.%20DO%20letter%20from%20Secretary%2C%20DoHFW%20to%20CS_AP%20Advisory_2025.pdf#page=22",
  filtration: "https://www.epa.gov/indoor-air-quality-iaq/air-cleaners-and-air-filters-home",
} as const;

export const MAX_IMPORT_BYTES = 64 * 1024;
const SIX_HOURS = 6 * 60 * 60 * 1000;

export function isStaleObservation(observedAt: string, now: number) {
  return now - Date.parse(observedAt) > SIX_HOURS;
}

export function observationTime(observedAt: string, locale: "en-IN" | "hi-IN" = "en-IN") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date(observedAt)) + " IST";
}

const bands = [
  [50, "Good"], [100, "Satisfactory"], [200, "Moderate"],
  [300, "Poor"], [400, "Very Poor"], [500, "Severe"],
] as const;

export function indianAqiBand(value: number) {
  if (!Number.isInteger(value) || value < 0) return null;
  return bands.find(([ceiling]) => value <= ceiling)?.[1] ?? null;
}

export function readingView(selection: ReadingSelection, now: number) {
  if (!selection) return null;
  if (selection === "replay") {
    const { place, invocation } = DELHI_REPLAY;
    const band = indianAqiBand(invocation.aqi);
    return {
      kind: "historical" as const,
      value: String(invocation.aqi), unit: "AQI", title: band ?? "Reported AQI", state: "Historical replay",
      place, band, scope: "City reading", time: replayDate(invocation.date), source: "CAQM order",
      url: invocation.url, averaging: "Averaging window unavailable in this order",
      normalization: null, origin: "Dated official order",
    };
  }
  const { location, source, observedAt, metric } = selection.observation;
  const eligibleScale = metric.kind === "aqi" && metric.scale === "india_naqi" && metric.basis === "overall";
  const stale = isStaleObservation(observedAt, now);
  const scaleName = metric.kind === "aqi" && metric.scale === "india_naqi" ? "Indian AQI"
    : metric.kind === "aqi" && metric.scale === "us_aqi" ? "US AQI" : "AQI";
  const band = eligibleScale ? indianAqiBand(metric.value) : null;
  return {
    kind: stale ? "stale" as const : eligibleScale ? "provided" as const : "display-only" as const,
    value: new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 8 }).format(metric.value),
    unit: metric.kind === "aqi" ? scaleName : metric.unit === "ug_m3" ? "µg/m³" : "mg/m³",
    title: band ?? (metric.kind === "pm25" ? "PM₂.₅ concentration" : metric.basis === "pollutant_subindex" ? "Pollutant sub-index" : "Reported AQI"),
    state: stale ? "Stale reading" : eligibleScale ? "User-supplied reading" : "Display only",
    place: location.label, band, scope: location.scope === "city" ? "City reading" : "Station reading",
    time: observationTime(observedAt),
    source: source.label, url: source.url && sourceHostname(source.url) ? source.url : undefined,
    origin: source.label === estimateSource.label && source.url === estimateSource.url ? "City model estimate" :
      selection.kind === "manual" ? "Manual entry" : "User-imported JSON",
    averaging: metric.averagingMinutes === null ? "Averaging window unavailable" : `${metric.averagingMinutes} min averaging window`,
    normalization: metric.kind === "pm25" && metric.unit === "mg_m3"
      ? `${new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 8 }).format(metric.value * 1000)} µg/m³ normalized` : null,
  };
}
