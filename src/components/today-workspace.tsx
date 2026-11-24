"use client";

import { useLocale } from "./locale";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, MapPin, PencilLine } from "lucide-react";
import { MAX_IMPORT_BYTES, type ReadingSelection } from "@/lib/readings";
import { DELHI_REPLAY, replayDate } from "@/lib/replay";
import { useDraftActions, useDraftState } from "./draft-provider";
import { ReadingDialog } from "./reading-dialog";
import { ReadingCard, ReplayDetails } from "./reading-card";
import { AtmospherePlate } from "./atmosphere-plate";
import { AppLink } from "./app-link";
import { CityReading } from "./city-reading";
import { CareHelp } from "./care-help";

export function TodayWorkspace() {
  const { t } = useLocale();
  const { invocation } = DELHI_REPLAY;
  const archiveMonth = replayDate(invocation.date, "en-IN", "short").replace(/^\d+ /, "");
  const { draft, ready, persistent } = useDraftState();
  const { updateDraft } = useDraftActions();
  const initialReading = draft.selection === "replay" ? undefined : draft.selection?.observation;
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
      const { validateObservation } = await import("@/lib/observation-schema");
      if (readingAction.current !== request) return;
      const result = validateObservation(data);
      if ("message" in result) setError(result.message);
      else selectReading({ kind: "import", observation: result.observation }, "Reading imported from your file.");
    } catch {
      if (readingAction.current === request) setError("The reading form could not load. Try again.");
    }
  }

  return (
    <main className="shell journal-shell" id="main-content">
      <section className="journal-lead" aria-labelledby="hero-title">
        <div className="lead-copy">
          <p className="journal-edition"><MapPin size={16} aria-hidden /> Delhi–NCR</p>
          <h1 id="hero-title">{t("Air quality and your day")}</h1>
          <p className="lead-dek">{t("Start with a local reading. Then plan school pickups, errands and time outdoors around what you can change.")}</p>
          <div className="reading-workspace">
            <ReadingCard />
            <div className="reading-actions">
              <button type="button" className={draft.selection ? "button button-subtle" : "button button-primary"} onClick={() => dialog.current?.showModal()} disabled={!ready}><PencilLine size={16} aria-hidden /> {t(draft.selection ? "Change reading" : "Enter a reading")}</button>
              <AppLink href="/plan" className={draft.selection ? "button button-primary" : "button button-subtle"}>{t("Open My Plan")}</AppLink>
            </div>
            <div className="reading-shortcuts">
              <button type="button" className="text-link" onClick={() => fileInput.current?.click()} disabled={!ready}><FileUp size={16} aria-hidden /> {t("Import JSON")}</button>
              <button type="button" className="text-link" disabled={!ready} onClick={loadReplay}>{t("Try historical replay")}</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importReading} />
            </div>
            <p role="status" className="form-notice">{notice}</p>
            {error && <p role="alert" className="form-error">{error} The selected reading is unchanged.</p>}
            <CityReading ready={ready} beginLookup={() => {
              const lookup = ++readingAction.current;
              return (observation) => {
                if (lookup !== readingAction.current) return false;
                selectReading({ kind: "import", observation }, "");
                return true;
              };
            }} />
            {ready && !persistent && <p className="muted">Draft storage is unavailable. Your changes last until you close or reload this page.</p>}
          </div>
        </div>
        <AtmospherePlate />
      </section>

      <section className="archive" aria-labelledby="replay-title">
        <div className="archive-index">
          <p className="eyebrow">{t("Historical replay")}</p>
          <time dateTime={invocation.date}>{invocation.date.slice(-2)} <span>{archiveMonth}</span></time>
        </div>
        <div className="archive-body">
          <h2 id="replay-title">When Delhi entered Stage III</h2>
          <p>See the {replayDate(invocation.date)} reading and the orders that followed.</p>
          <ReplayDetails />
        </div>
        <div className="archive-value">
          <span className="sr-only">Historical reading for {DELHI_REPLAY.place} on {replayDate(invocation.date)}.</span>
          <strong>{invocation.aqi}</strong><span>City AQI · Very Poor</span>
        </div>
      </section>

      <CareHelp />
      <ReadingDialog dialogRef={dialog} initial={initialReading} onSave={(observation) => selectReading({ kind: "manual", observation }, "Reading added.")} />
    </main>
  );
}
