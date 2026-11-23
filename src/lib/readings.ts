import type { ReadingSelection } from "./observation-schema";
export type { Observation, ReadingSelection } from "./observation-schema";

export const SOURCES = {
  cpcb: "https://airquality.cpcb.gov.in/AQI_India/",
  indoor: "https://ncdc.mohfw.gov.in/uploads/pdf/air1.pdf#page=16",
  invocation: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/ec558594-4012-4304-8308-9800770792c2.pdf",
  revocation: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/b91570de-8cc1-4735-8879-28f2bc1550f2.pdf",
  additionalMeasures: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/22e7a559-e78f-49b0-b3f6-3f4e93cfa80f.pdf",
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

export function readingView(selection: ReadingSelection, now: number) {
  if (!selection) return null;
  if (selection === "replay") {
    return {
      kind: "historical" as const,
      value: "382", unit: "AQI", title: "Very Poor", state: "Historical replay",
      place: "Delhi", scope: "City reading", time: "6 November 2026", source: "CAQM order",
      url: SOURCES.invocation, averaging: "Averaging window unavailable in this order",
      normalization: null, origin: "Dated official order",
    };
  }
  const { location, source, observedAt, metric } = selection.observation;
  const eligibleScale = metric.kind === "aqi" && metric.scale === "india_naqi" && metric.basis === "overall";
  const stale = isStaleObservation(observedAt, now);
  const scaleName = metric.kind === "aqi" && metric.scale === "india_naqi" ? "Indian AQI"
    : metric.kind === "aqi" && metric.scale === "us_aqi" ? "US AQI" : "AQI";
  const band = eligibleScale ? bands.find(([ceiling]) => metric.value <= ceiling)?.[1] : null;
  return {
    kind: stale ? "stale" as const : eligibleScale ? "provided" as const : "display-only" as const,
    value: new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 8 }).format(metric.value),
    unit: metric.kind === "aqi" ? scaleName : metric.unit === "ug_m3" ? "µg/m³" : "mg/m³",
    title: band ?? (metric.kind === "pm25" ? "PM₂.₅ concentration" : metric.basis === "pollutant_subindex" ? "Pollutant sub-index" : "Reported AQI"),
    state: stale ? "Stale reading" : eligibleScale ? "User-supplied reading" : "Display only",
    place: location.label, scope: location.scope === "city" ? "City reading" : "Station reading",
    time: observationTime(observedAt),
    source: source.label, url: source.url,
    origin: selection.kind === "manual" ? "Manual entry" : "User-imported JSON",
    averaging: metric.averagingMinutes === null ? "Averaging window unavailable" : `${metric.averagingMinutes} min averaging window`,
    normalization: metric.kind === "pm25" && metric.unit === "mg_m3"
      ? `${new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 8 }).format(metric.value * 1000)} µg/m³ normalized` : null,
  };
}
