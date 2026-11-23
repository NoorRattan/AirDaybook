"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, ArrowUpRight, FileUp, MapPin, PencilLine } from "lucide-react";
import { MAX_IMPORT_BYTES, type ReadingSelection } from "@/lib/readings";
import { useDraft } from "./draft-provider";
import { ReadingDialog } from "./reading-dialog";
import { ReadingCard, ReplayDetails } from "./reading-card";
import { AtmospherePlate } from "./atmosphere-plate";
import { JournalScroll } from "./journal-scroll";

export function TodayWorkspace() {
  const { updateDraft, ready, persistent } = useDraft();
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
      if (readingAction.current !== request) return;
      setError("This file could not be read as JSON.");
      return;
    }
    if (readingAction.current !== request) return;
    try {
      const { parseObservation } = await import("@/lib/observation-schema");
      if (readingAction.current !== request) return;
      selectReading({ kind: "import", observation: parseObservation(data) }, "Reading imported from your file.");
    } catch (cause) {
      if (readingAction.current !== request) return;
      setError(cause instanceof Error ? cause.message : "The reading could not be imported.");
    }
  }

  return (
    <main className="shell journal-shell" id="main-content">
      <section className="journal-lead" aria-labelledby="hero-title">
        <div className="journal-edition">
          <span><MapPin size={14} aria-hidden /> Delhi–NCR</span>
          <span>Air quality journal</span>
        </div>
        <div className="lead-copy">
          <h1 id="hero-title">The air<br /><em>around us.</em></h1>
          <p className="lead-dek">Read the air. Plan around what can’t move.</p>
          <div className="reading-workspace">
            <ReadingCard />
            <div className="reading-actions">
              <button type="button" className="button button-primary" onClick={() => dialog.current?.showModal()} disabled={!ready}><PencilLine size={16} aria-hidden /> Enter a reading</button>
              <button type="button" className="button button-subtle" onClick={() => fileInput.current?.click()} disabled={!ready}><FileUp size={16} aria-hidden /> Import JSON</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importReading} />
            </div>
            <div role="status">{notice && <p className="form-notice">{notice}</p>}</div>
            {error && <p role="alert" className="form-error">{error} The selected reading is unchanged.</p>}
            {ready && !persistent && <p className="muted">Draft storage is unavailable. Your changes last until you close or reload this page.</p>}
            <Link href="/plan" prefetch={false} className="text-link plan-link">Make a plan <ArrowRight size={17} aria-hidden /></Link>
          </div>
        </div>
        <AtmospherePlate />
      </section>

      <section className="archive" aria-labelledby="replay-title" data-journal-archive>
        <div className="archive-index">
          <p className="eyebrow">Historical replay</p>
          <time dateTime="2026-11-06">06 <span>Nov 2026</span></time>
        </div>
        <div className="archive-body">
          <h2 id="replay-title">When Delhi entered Stage III</h2>
          <p>Follow two dated CAQM orders, from the forecast that triggered Stage III to its revocation.</p>
          <button type="button" className="button button-primary" disabled={!ready} onClick={loadReplay}>Try historical replay <ArrowUpRight size={17} aria-hidden /></button>
          <ReplayDetails />
        </div>
        <div className="archive-value" aria-label="Delhi city AQI 382 on 6 November 2026, historical">
          <strong>382</strong><span>City AQI · Very Poor</span>
        </div>
      </section>

      <ReadingDialog dialogRef={dialog} onSave={(observation) => selectReading({ kind: "manual", observation }, "Reading added.")} />
      <JournalScroll />
    </main>
  );
}
