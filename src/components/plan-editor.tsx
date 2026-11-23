"use client";

import { CalendarClock, Footprints } from "lucide-react";
import { useState, type FormEvent } from "react";
import { compareWaiting, MAX_COMMITMENT_LENGTH, MAX_WAIT_MINUTES, parsePlan, parseWait, type Plan } from "@/lib/plan";

function WaitComparison({ before, after }: { before: number | null; after: number | null }) {
  const { delta, currentFraction, revisedFraction } = compareWaiting(before, after);
  const bars = [
    { label: "Current", value: before, kind: "current", fraction: currentFraction },
    { label: "Revised", value: after, kind: "revised", fraction: revisedFraction },
  ] as const;
  const result = delta === null ? "Compare two waits."
    : delta === 0 ? "No change." : `${Math.abs(delta)} min ${delta > 0 ? "less" : "more"} outside`;

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="section-line">
        <h2 id="comparison-title" className="eyebrow"><Footprints size={17} aria-hidden /> Outdoor waiting</h2>
        <span className="eyebrow comparison-unit">Minutes</span>
      </div>
      <p className="comparison-result" role="status">{result}</p>
      <dl className="wait-graphic">
        {bars.map(({ label, value, kind, fraction }) => (
          <div className="wait-row" key={kind}>
            <dt>{label}</dt>
            <dd>
              <div className="wait-track" aria-hidden>
                <span className={`wait-fill wait-fill-${kind}`} style={{ width: `${fraction * 100}%` }} />
              </div>
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
  const [error, setError] = useState("");
  const [before, setBefore] = useState(String(initial?.previousWait ?? ""));
  const [after, setAfter] = useState(String(initial?.revisedWait ?? ""));

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const result = parsePlan({
      commitment: String(fields.get("commitment") ?? ""),
      time: String(fields.get("time") ?? ""),
      previousWait: before,
      revisedWait: after,
    });
    if ("error" in result) {
      setError(result.error);
      const invalid = form.elements.namedItem(result.field);
      if (invalid instanceof HTMLElement) invalid.focus();
      return;
    }
    setError("");
    onSave(result.plan);
  }

  return (
    <div className="planner-grid" id="schedule" tabIndex={-1}>
      <section className="planner-panel" aria-labelledby="commitment-title">
        <div className="section-line">
          <h2 id="commitment-title" className="section-title"><CalendarClock size={19} aria-hidden /> Schedule</h2>
        </div>
        <form className="plan-form" onSubmit={savePlan} aria-describedby={error ? "plan-error" : undefined}>
          <div className="commitment-inputs">
            <label>Commitment<input name="commitment" required maxLength={MAX_COMMITMENT_LENGTH} defaultValue={initial?.commitment ?? ""} disabled={!ready} placeholder="e.g. School pickup" /></label>
            <label>Fixed time<input name="time" type="time" required defaultValue={initial?.time ?? ""} disabled={!ready} /></label>
          </div>
          <fieldset>
            <legend>Outdoor waiting estimates</legend>
            <div className="time-inputs">
              <label>Current wait (min)<input name="previousWait" type="number" min={0} max={MAX_WAIT_MINUTES} step={1} value={before} onChange={(event) => setBefore(event.target.value)} disabled={!ready} /></label>
              <label>Revised wait (min)<input name="revisedWait" type="number" min={0} max={MAX_WAIT_MINUTES} step={1} value={after} onChange={(event) => setAfter(event.target.value)} disabled={!ready} /></label>
            </div>
          </fieldset>
          {error && <p id="plan-error" role="alert" className="form-error">{error}</p>}
          <button className="button button-primary" type="submit" disabled={!ready}>Save plan</button>
        </form>
      </section>
      <WaitComparison before={parseWait(before).minutes} after={parseWait(after).minutes} />
    </div>
  );
}
