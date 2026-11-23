"use client";

import { ArrowUpRight, CalendarClock, Clock3, Footprints, LockKeyhole, Radio, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { emptyDraft, type Plan } from "@/lib/draft";
import { readingView } from "@/lib/readings";
import { useDraft } from "./draft-provider";
import { PlanPreferences } from "./plan-preferences";

const replayPlan: Plan = {
  commitment: "School pickup", time: "15:00", previousWait: null, revisedWait: null,
};

function displayTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return { clock: `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`, meridiem: hour < 12 ? "am" : "pm" };
}

function waitMinutes(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 1440 ? number : null;
}

function WaitComparison({ before, after }: { before: number | null; after: number | null }) {
  const scale = Math.max(before ?? 0, after ?? 0, 1);
  const delta = before === null || after === null ? null : before - after;
  const results = [
    { label: "Current", value: before, kind: "current" },
    { label: "Revised", value: after, kind: "revised" },
  ] as const;

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="section-line">
        <h2 id="comparison-title" className="eyebrow"><Footprints size={17} aria-hidden /> Outdoor waiting</h2>
        <span className="eyebrow comparison-unit">Minutes</span>
      </div>
      <p className="comparison-result">{delta === null ? "Compare two waits." : delta === 0 ? "No change." : `${Math.abs(delta)} min ${delta > 0 ? "less" : "more"} outside`}</p>
      <dl className="wait-graphic">
        {results.map(({ label, value, kind }) => (
          <div className="wait-row" key={kind}>
            <dt>{label}</dt>
            <dd>
              <div className="wait-track" aria-hidden>
                <span className={`wait-fill wait-fill-${kind}`} style={{ width: `${(value ?? 0) / scale * 100}%` }} />
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

function PlanEditor({ initial, ready, onSave }: { initial: Plan | null; ready: boolean; onSave: (plan: Plan) => void }) {
  const [error, setError] = useState("");
  const [commitment, setCommitment] = useState(initial?.commitment ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [before, setBefore] = useState(String(initial?.previousWait ?? ""));
  const [after, setAfter] = useState(String(initial?.revisedWait ?? ""));
  const saving = useRef(false);

  useEffect(() => {
    setCommitment(initial?.commitment ?? "");
    setTime(initial?.time ?? "");
    setBefore(String(initial?.previousWait ?? ""));
    setAfter(String(initial?.revisedWait ?? ""));
  }, [initial]);

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving.current) return;
    const form = event.currentTarget;
    saving.current = true;
    try {
      const { planSchema } = await import("@/lib/draft-schema");
      if (!form.isConnected) return;
      const response = planSchema.safeParse({
        commitment, time, previousWait: waitMinutes(before), revisedWait: waitMinutes(after),
      });
      if (!response.success) {
        setError(response.error.issues[0].message);
        return;
      }
      setError("");
      onSave(response.data);
    } catch {
      if (form.isConnected) setError("The plan could not be saved. Try again.");
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="planner-grid">
      <section className="planner-panel" aria-labelledby="commitment-title">
        <div className="section-line">
          <h2 id="commitment-title" className="eyebrow"><CalendarClock size={17} aria-hidden /> Edit your plan</h2>
          <LockKeyhole size={16} className="muted" aria-hidden />
        </div>
        <form className="plan-form" onSubmit={savePlan} aria-describedby={error ? "plan-error" : undefined}>
          <div className="commitment-inputs">
            <label>Commitment<input name="commitment" required maxLength={100} value={commitment} onChange={(event) => setCommitment(event.target.value)} disabled={!ready} placeholder="e.g. School pickup" /></label>
            <label>Fixed time<input name="time" type="time" required value={time} onChange={(event) => setTime(event.target.value)} disabled={!ready} /></label>
          </div>
          <fieldset>
            <legend>Outdoor waiting estimates</legend>
            <div className="time-inputs">
              <label>Current wait (min)<input name="previousWait" type="number" min={0} max={1440} step={1} value={before} onChange={(event) => setBefore(event.target.value)} disabled={!ready} /></label>
              <label>Revised wait (min)<input name="revisedWait" type="number" min={0} max={1440} step={1} value={after} onChange={(event) => setAfter(event.target.value)} disabled={!ready} /></label>
            </div>
          </fieldset>
          {error && <p id="plan-error" role="alert" className="form-error">{error}</p>}
          <button className="button button-primary" type="submit" disabled={!ready}>Save plan <ArrowUpRight size={16} aria-hidden /></button>
        </form>
      </section>
      <WaitComparison before={waitMinutes(before)} after={waitMinutes(after)} />
    </div>
  );
}

export function PlanWorkspace() {
  const { draft, updateDraft, ready, persistent, now } = useDraft();
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(0);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reading = readingView(draft.selection, now);
  const plan = draft.plan;
  const time = plan ? displayTime(plan.time) : null;
  const initial = plan ?? (draft.selection === "replay" ? replayPlan : null);

  function clearData() {
    updateDraft(() => emptyDraft);
    clearDialog.current?.close();
    setEditor((value) => value + 1);
    setNotice("Reading and plan cleared.");
    heading.current?.focus();
  }

  return (
    <main className="shell journal-shell planner-shell" id="main-content">
      <div className="planner-heading">
        <p className="eyebrow">Your day</p>
        <h1 ref={heading} tabIndex={-1}>My <em>Plan.</em></h1>
        <p>Set the time that stays fixed. Compare the minutes you can change.</p>
      </div>

      <section className="commitment-band" aria-labelledby="fixed-time-display">
        <div>
          <h2 className="eyebrow" id="fixed-time-display"><Clock3 size={17} aria-hidden /> Fixed commitment</h2>
          {time ? (
            <>
              <p className="plan-clock">{time.clock} <span>{time.meridiem}</span></p>
              <p className="plan-commitment">{plan?.commitment}</p>
            </>
          ) : <p className="plan-clock unset">No time saved.</p>}
        </div>
        <div className="plan-reading">
          <span className="eyebrow"><Radio size={16} aria-hidden /> Selected reading</span>
          <strong>{reading ? `${reading.place} · ${reading.value} ${reading.unit}` : "No reading selected"}</strong>
          {reading && <p>{reading.state} · {reading.time}</p>}
        </div>
      </section>

      <PlanEditor key={editor} initial={initial} ready={ready} onSave={(next) => {
        updateDraft((current) => ({ ...current, plan: next }));
        setNotice("Plan updated.");
      }} />
      <PlanPreferences key={editor} />
      <div className="plan-footer">
        <div>
          <p>{persistent ? "Your reading and plan stay on this device." : "Draft storage is unavailable. Your changes last until you close or reload this page."}</p>
          <p role="status" className="form-notice">{notice}</p>
        </div>
        <button className="button button-subtle" disabled={!ready || (!draft.selection && !plan && !draft.previousPreferences)} onClick={() => clearDialog.current?.showModal()}><Trash2 size={16} aria-hidden /> Clear saved data</button>
      </div>
      <dialog className="entry-dialog clear-dialog" ref={clearDialog} aria-labelledby="clear-title">
        <div className="dialog-top">
          <div><h2 id="clear-title">Clear saved data?</h2><p>This removes the selected reading, plan and preferences from this device.</p></div>
          <button type="button" aria-label="Close" className="icon-button" onClick={() => clearDialog.current?.close()}><X size={22} aria-hidden /></button>
        </div>
        <div className="form-actions">
          <button className="button button-subtle" onClick={() => clearDialog.current?.close()}>Cancel</button>
          <button className="button button-primary" onClick={clearData}>Clear reading and plan</button>
        </div>
      </dialog>
    </main>
  );
}
