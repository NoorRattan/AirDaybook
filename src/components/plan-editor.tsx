"use client";

import { useLocale } from "./locale";

import { CalendarClock, Footprints } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { compareWaiting, MAX_COMMITMENT_LENGTH, MAX_WAIT_MINUTES, parsePlan, parseWait, type Plan } from "@/lib/plan";

function WaitComparison({ before, after }: { before: number | null; after: number | null }) {
  const { t } = useLocale();
  const { delta, currentFraction, revisedFraction } = compareWaiting(before, after);
  const bars = [
    { label: "Current", value: before, kind: "current", fraction: currentFraction },
    { label: "Revised", value: after, kind: "revised", fraction: revisedFraction },
  ] as const;
  const result = delta === null ? "Compare two waits."
    : delta === 0 ? "No change." : `${Math.abs(delta)} min ${delta > 0 ? "less" : "more"} outside`;
  const [announcement, setAnnouncement] = useState(result);
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(result), 350);
    return () => window.clearTimeout(timer);
  }, [result]);

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="section-line">
        <h2 id="comparison-title" className="eyebrow"><Footprints size={17} aria-hidden /> {t("Outdoor waiting")}</h2>
        <span className="eyebrow comparison-unit">{t("Minutes")}</span>
      </div>
      <p className="comparison-result" aria-hidden="true">{result}</p>
      <p className="sr-only" role="status">Outdoor waiting. {announcement}</p>
      <dl className="wait-graphic">
        {bars.map(({ label, value, kind, fraction }) => (
          <div className="wait-row" key={kind}>
            <dt>{label}</dt>
            <dd>
              <svg className="wait-track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden>
                <rect className={`wait-fill-${kind}`} width={fraction * 100} height={1} />
              </svg>
              <strong>{value === null ? "—" : `${value} min`}</strong>
            </dd>
          </div>
        ))}
      </dl>
      <p className="comparison-note">{delta === null ? "Enter both waiting times to see the difference." : "The bars share a scale. The scheduled time is the same for both options."}</p>
    </section>
  );
}

export function PlanEditor({ initial, ready, onSave }: { initial: Plan | null; ready: boolean; onSave: (plan: Plan) => void }) {
  const { t } = useLocale();
  const [error, setError] = useState<{ field: keyof Plan; error: string } | null>(null);
  const [edits, setEdits] = useState<Partial<Record<keyof Plan, string>>>({});
  const fields = {
    commitment: edits.commitment ?? initial?.commitment ?? "",
    time: edits.time ?? initial?.time ?? "",
    previousWait: edits.previousWait ?? String(initial?.previousWait ?? ""),
    revisedWait: edits.revisedWait ?? String(initial?.revisedWait ?? ""),
  };

  function inputProps(field: keyof Plan) {
    return {
      name: field, value: fields[field], disabled: !ready,
      "aria-invalid": error?.field === field || undefined,
      "aria-describedby": error?.field === field ? "plan-error" : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setEdits((current) => {
          const next = { ...current };
          if (value === String(initial?.[field] ?? "")) delete next[field];
          else next[field] = value;
          return next;
        });
        setError(null);
      },
    };
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const form = event.currentTarget;
    const result = parsePlan(fields);
    if ("error" in result) {
      setError(result);
      const invalid = form.elements.namedItem(result.field);
      if (invalid instanceof HTMLElement) invalid.focus();
      return;
    }
    setError(null);
    setEdits({});
    onSave(result.plan);
  }

  return (
    <div className="planner-grid" id="schedule" tabIndex={-1}>
      <section className="planner-panel" aria-labelledby="commitment-title">
        <div className="section-line">
          <h2 id="commitment-title" className="section-title"><CalendarClock size={19} aria-hidden /> {t("Schedule")}</h2>
        </div>
        <form className="plan-form" onSubmit={savePlan}>
          <div className="commitment-inputs">
            <label>{t("Commitment")}<input {...inputProps("commitment")} required maxLength={MAX_COMMITMENT_LENGTH} placeholder="e.g. School pickup" /></label>
            <label>{t("Fixed time")}<input {...inputProps("time")} type="time" required /></label>
          </div>
          <fieldset>
            <legend>{t("Outdoor waiting estimates")}</legend>
            <div className="time-inputs">
              <label>{t("Current wait (min)")}<input {...inputProps("previousWait")} type="number" min={0} max={MAX_WAIT_MINUTES} step={1} /></label>
              <label>{t("Revised wait (min)")}<input {...inputProps("revisedWait")} type="number" min={0} max={MAX_WAIT_MINUTES} step={1} /></label>
            </div>
          </fieldset>
          <p id="plan-error" role="alert" className={error ? "form-error" : "sr-only"}>{error?.error}</p>
          <button className="button button-primary" type="submit" disabled={!ready}>{t("Save plan")}</button>
        </form>
      </section>
      <WaitComparison before={parseWait(fields.previousWait).minutes} after={parseWait(fields.revisedWait).minutes} />
    </div>
  );
}
