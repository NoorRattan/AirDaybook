"use client";

import { useLocale } from "./locale";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { X } from "lucide-react";
import type { Observation } from "@/lib/readings";

const offsetPattern = "(?:\\+|-)(?:[01][0-9]|2[0-3]):[0-5][0-9]";
const offsetAtEnd = /(Z|[+-]\d{2}:\d{2})$/;

export function ReadingDialog({ dialogRef, initial, onSave }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  initial?: Observation;
  onSave: (observation: Observation) => void;
}) {
  const { t } = useLocale();
  const [kindEdit, setKindEdit] = useState<"aqi" | "pm25" | null>(null);
  const [selectEdits, setSelectEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const submission = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const kind = kindEdit ?? initial?.metric.kind ?? "aqi";
  const metric = initial?.metric;
  const initialOffset = initial?.observedAt.match(offsetAtEnd)?.[0];

  useEffect(() => {
    if (!dialogRef.current?.open) formRef.current?.reset();
  }, [dialogRef, initial]);

  useEffect(() => {
    if (!error?.field) return;
    const field = formRef.current?.elements.namedItem(error.field);
    if (field instanceof HTMLElement) field.focus();
  }, [error]);

  function fieldProps(name: string) {
    return {
      name,
      "aria-invalid": error?.field === name || undefined,
      "aria-describedby": error?.field === name ? "reading-entry-error" : undefined,
    };
  }
  function selectProps(name: string, initialValue: string) {
    return {
      ...fieldProps(name), value: selectEdits[name] ?? initialValue,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setSelectEdits((current) => ({ ...current, [name]: value }));
      },
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const sourceLink = String(form.get("sourceUrl") ?? "").trim();
    const observedAt = String(form.get("observedAt") ?? "");
    const offset = String(form.get("offset") ?? "");
    if (!new RegExp(`^${offsetPattern}$`).test(offset)) {
      setError({ field: "offset", message: "Enter a UTC offset such as +05:30 for Indian Standard Time." });
      return;
    }
    const request = ++submission.current;
    setSaving(true);
    const averaging = form.get("averaging");
    const value = form.get("value");
    const units = { value: value ? Number(value) : NaN, averagingMinutes: averaging ? Number(averaging) : null };
    try {
      const { validateObservation } = await import("@/lib/observation-schema");
      if (submission.current !== request || !dialogRef.current?.open) return;
      const result = validateObservation({
        schemaVersion: 1,
        location: { label: form.get("location"), scope: form.get("scope") },
        source: { label: form.get("source"), ...(sourceLink ? { url: sourceLink } : {}) },
        observedAt: observedAt ? observedAt + offset : "",
        metric: kind === "aqi" ? { kind, ...units, scale: form.get("scale"), basis: form.get("basis") }
          : { kind, ...units, unit: form.get("unit") },
      });
      if ("message" in result) {
        setError(result);
        return;
      }
      setError(null);
      dialogRef.current?.close();
      onSave(result.observation);
    } catch {
      if (submission.current === request) setError({ field: null, message: "The reading form could not load. Try again." });
    } finally {
      if (submission.current === request) setSaving(false);
    }
  }

  return (
    <dialog className="entry-dialog" ref={dialogRef} aria-labelledby="entry-title" onClose={() => {
      submission.current++;
      formRef.current?.reset();
      setKindEdit(null);
      setSelectEdits({});
      setSaving(false);
      setError(null);
    }}>
      <div className="dialog-top">
        <div>
          <h2 id="entry-title">{t("Enter a reading")}</h2>
          <p>{t("Use the value and time reported by your source.")}</p>
        </div>
        <button type="button" aria-label="Close reading form" className="icon-button" onClick={() => dialogRef.current?.close()}><X size={22} aria-hidden /></button>
      </div>
      <form ref={formRef} className="entry-form" onSubmit={submit} aria-busy={saving} onChange={() => setError(null)}>
        <label>{t("City or station name")}<input {...fieldProps("location")} defaultValue={initial?.location.label} required maxLength={100} /></label>
        <label>{t("Geographic scope")}<select {...selectProps("scope", initial?.location.scope ?? "city")}><option value="city">{t("City")}</option><option value="station">{t("Station")}</option></select></label>
        <label>{t("Source name")}<input {...fieldProps("source")} defaultValue={initial?.source.label} required maxLength={100} /></label>
        <label>{t("Source link (optional)")}<input {...fieldProps("sourceUrl")} type="url" maxLength={500} defaultValue={initial?.source.url} /></label>
        <label>{t("Observation time")}<input {...fieldProps("observedAt")} type="datetime-local" step="any" required defaultValue={initial?.observedAt.replace(offsetAtEnd, "")} /></label>
        <label>{t("UTC offset (+05:30 for IST)")}<input {...fieldProps("offset")} pattern={offsetPattern} title="Enter an offset such as +05:30" maxLength={6} required defaultValue={initialOffset === "Z" ? "+00:00" : initialOffset ?? "+05:30"} /></label>
        <label>{t("Metric")}<select {...fieldProps("kind")} value={kind} onChange={(event) => setKindEdit(event.target.value === "pm25" ? "pm25" : "aqi")}><option value="aqi">AQI</option><option value="pm25">PM₂.₅ concentration</option></select></label>
        {kind === "aqi"
          ? <>
              <label>{t("Scale")}<select {...selectProps("scale", metric?.kind === "aqi" ? metric.scale : "india_naqi")}><option value="india_naqi">{t("Indian AQI")}</option><option value="us_aqi">{t("US AQI")}</option><option value="unknown">{t("Unknown")}</option></select></label>
              <label>{t("Basis")}<select {...selectProps("basis", metric?.kind === "aqi" ? metric.basis : "overall")}><option value="overall">{t("Overall AQI")}</option><option value="pollutant_subindex">{t("Pollutant sub-index")}</option><option value="unknown">{t("Unknown")}</option></select></label>
            </>
          : <label>{t("Unit")}<select {...selectProps("unit", metric?.kind === "pm25" ? metric.unit : "ug_m3")}><option value="ug_m3">µg/m³</option><option value="mg_m3">mg/m³</option></select></label>}
        <label>{t("Reported value")}<input {...fieldProps("value")} type="number" min={0} step={kind === "aqi" ? 1 : "any"} defaultValue={metric?.value} required /></label>
        <label>{t("Averaging minutes (optional)")}<input {...fieldProps("averaging")} type="number" min={1} step={1} defaultValue={metric?.averagingMinutes ?? undefined} /></label>
        <p id="reading-entry-error" role="alert" className={error ? "form-error entry-wide" : "sr-only"}>{error?.message}</p>
        <div className="entry-wide form-actions">
          <button type="button" className="button button-subtle" onClick={() => dialogRef.current?.close()}>{t("Cancel")}</button>
          <button type="submit" className="button button-primary" disabled={saving}>{t("Save reading")}</button>
        </div>
      </form>
    </dialog>
  );
}
