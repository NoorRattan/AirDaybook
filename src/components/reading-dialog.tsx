"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { X } from "lucide-react";
import type { Observation } from "@/lib/readings";

export function ReadingDialog({ dialogRef, onSave }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onSave: (observation: Observation) => void;
}) {
  const [kind, setKind] = useState<"aqi" | "pm25">("aqi");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submission = useRef(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = ++submission.current;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const sourceLink = String(form.get("sourceUrl") ?? "").trim();
    const averaging = form.get("averaging");
    const units = { value: Number(form.get("value")), averagingMinutes: averaging ? Number(averaging) : null };
    try {
      const { parseObservation } = await import("@/lib/observation-schema");
      if (submission.current !== request || !dialogRef.current?.open) return;
      const result = parseObservation({
        schemaVersion: 1,
        location: { label: form.get("location"), scope: form.get("scope") },
        source: { label: form.get("source"), ...(sourceLink ? { url: sourceLink } : {}) },
        observedAt: `${form.get("observedAt")}+05:30`,
        metric: kind === "aqi" ? { kind, ...units, scale: form.get("scale"), basis: form.get("basis") }
          : { kind, ...units, unit: form.get("unit") },
      });
      setError("");
      dialogRef.current?.close();
      onSave(result);
    } catch (cause) {
      if (submission.current === request) setError(cause instanceof Error ? cause.message : "The reading could not be saved.");
    } finally {
      if (submission.current === request) setSaving(false);
    }
  }

  return (
    <dialog className="entry-dialog" ref={dialogRef} aria-labelledby="entry-title" onClose={() => { submission.current++; setSaving(false); setError(""); }}>
      <div className="dialog-top">
        <div>
          <h2 id="entry-title">Enter a reading</h2>
          <p>Use the value and time reported by your source.</p>
        </div>
        <button type="button" aria-label="Close reading form" className="icon-button" onClick={() => dialogRef.current?.close()}><X size={22} aria-hidden /></button>
      </div>
      <form className="entry-form" onSubmit={submit} aria-describedby={error ? "reading-entry-error" : undefined}>
        <label>City or station name<input name="location" required maxLength={100} /></label>
        <label>Geographic scope<select name="scope"><option value="city">City</option><option value="station">Station</option></select></label>
        <label>Source name<input name="source" required maxLength={100} /></label>
        <label>Source link (optional)<input name="sourceUrl" type="url" maxLength={500} /></label>
        <label>Observation time (IST)<input name="observedAt" type="datetime-local" required /></label>
        <label>Metric<select name="kind" value={kind} onChange={(event) => setKind(event.target.value === "pm25" ? "pm25" : "aqi")}><option value="aqi">AQI</option><option value="pm25">PM₂.₅ concentration</option></select></label>
        {kind === "aqi"
          ? <>
              <label>Scale<select name="scale"><option value="india_naqi">Indian AQI</option><option value="us_aqi">US AQI</option><option value="unknown">Unknown</option></select></label>
              <label>Basis<select name="basis"><option value="overall">Overall AQI</option><option value="pollutant_subindex">Pollutant sub-index</option><option value="unknown">Unknown</option></select></label>
            </>
          : <label>Unit<select name="unit"><option value="ug_m3">µg/m³</option><option value="mg_m3">mg/m³</option></select></label>}
        <label>Reported value<input name="value" type="number" min={0} step={kind === "aqi" ? 1 : "any"} required /></label>
        <label>Averaging minutes (optional)<input name="averaging" type="number" min={1} step={1} /></label>
        {error && <p id="reading-entry-error" role="alert" className="form-error entry-wide">{error}</p>}
        <div className="entry-wide form-actions">
          <button type="button" className="button button-subtle" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={saving}>Save reading</button>
        </div>
      </form>
    </dialog>
  );
}
