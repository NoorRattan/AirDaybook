"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, MapPin, PencilLine } from "lucide-react";
import { MAX_IMPORT_BYTES, type ReadingSelection } from "@/lib/readings";
import { DELHI_REPLAY, replayDate } from "@/lib/replay";
import { useDraft } from "./draft-provider";
import { ReadingDialog } from "./reading-dialog";
import { ReadingCard, ReplayDetails } from "./reading-card";
import { AtmospherePlate } from "./atmosphere-plate";
import { AppLink } from "./app-link";

export function TodayWorkspace() {
  const { invocation } = DELHI_REPLAY;
  const archiveMonth = replayDate(invocation.date, "en-IN", "short").replace(/^\d+ /, "");
  const { draft, updateDraft, ready, persistent } = useDraft();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readingAction = useRef(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function selectReading(selection: ReadingSelection, message: string) {
    readingAction.current++;
    setError("");
    setNotice(message);
    updateDraft((current) => ({ ...current, selection }));
  }

  function loadReplay() {
    selectReading("replay", "Historical replay selected.");
    document.getElementById("active-reading")?.focus();
  }

  async function importReading(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++readingAction.current;
    setNotice("");
    setError("");
    if (file.size > MAX_IMPORT_BYTES) {
      setError("Choose a JSON file that is 64 KiB or smaller.");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      if (readingAction.current === request) setError("This file could not be read as JSON.");
      return;
    }
    if (readingAction.current !== request) return;
    try {
      const { parseObservation } = await import("@/lib/observation-schema");
      if (readingAction.current !== request) return;
      selectReading({ kind: "import", observation: parseObservation(data) }, "Reading imported from your file.");
    } catch (cause) {
      if (readingAction.current === request) {
        setError(cause instanceof Error ? cause.message : "The reading could not be imported.");
      }
    }
  }

  return (
    <main className="shell journal-shell" id="main-content">
      <section className="journal-lead" aria-labelledby="hero-title">
        <div className="lead-copy">
          <p className="journal-edition"><MapPin size={16} aria-hidden /> Delhi–NCR</p>
          <h1 id="hero-title">Air quality and your day</h1>
          <p className="lead-dek">Start with a local reading. Then plan school pickups, errands and time outdoors around what you can change.</p>
          <div className="reading-workspace">
            <ReadingCard />
            <div className="reading-actions">
              <button type="button" className={draft.selection ? "button button-subtle" : "button button-primary"} onClick={() => dialog.current?.showModal()} disabled={!ready}><PencilLine size={16} aria-hidden /> {draft.selection ? "Change reading" : "Enter a reading"}</button>
              <AppLink href="/plan" className={draft.selection ? "button button-primary" : "button button-subtle"}>Open My Plan</AppLink>
            </div>
            <div className="reading-shortcuts">
              <button type="button" className="text-link" onClick={() => fileInput.current?.click()} disabled={!ready}><FileUp size={16} aria-hidden /> Import JSON</button>
              <button type="button" className="text-link" disabled={!ready} onClick={loadReplay}>Try historical replay</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importReading} />
            </div>
            <p role="status" className="form-notice">{notice}</p>
            {error && <p role="alert" className="form-error">{error} The selected reading is unchanged.</p>}
            {ready && !persistent && <p className="muted">Draft storage is unavailable. Your changes last until you close or reload this page.</p>}
          </div>
        </div>
        <AtmospherePlate />
      </section>

      <section className="archive" aria-labelledby="replay-title">
        <div className="archive-index">
          <p className="eyebrow">Historical replay</p>
          <time dateTime={invocation.date}>{invocation.date.slice(-2)} <span>{archiveMonth}</span></time>
        </div>
        <div className="archive-body">
          <h2 id="replay-title">When Delhi entered Stage III</h2>
          <p>See the {replayDate(invocation.date)} reading and the orders that followed.</p>
          <ReplayDetails />
        </div>
        <div className="archive-value" aria-label={DELHI_REPLAY.place + " city AQI " + invocation.aqi + " on " + replayDate(invocation.date) + ", historical"}>
          <strong>{invocation.aqi}</strong><span>City AQI · Very Poor</span>
        </div>
      </section>

      <ReadingDialog dialogRef={dialog} onSave={(observation) => selectReading({ kind: "manual", observation }, "Reading added.")} />
    </main>
  );
}
