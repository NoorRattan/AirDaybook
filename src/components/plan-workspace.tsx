"use client";

import { Clock3, Radio, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { emptyDraft } from "@/lib/draft";
import { displayPlanTime, initialPlan } from "@/lib/plan";
import { planningActions } from "@/lib/planning-actions";
import { readingView } from "@/lib/readings";
import { AppLink } from "./app-link";
import { useDraft } from "./draft-provider";
import { PlanningActions } from "./planning-actions";
import { PlanTool } from "./plan-tool";
import { PlanEditor } from "./plan-editor";
import { PlanLink } from "./plan-link";

const toolLoading = () => <p role="status">Opening tool…</p>;
const PlanPreferences = dynamic(() => import("./plan-preferences").then((module) => module.PlanPreferences), { ssr: false, loading: toolLoading });
const TripComparison = dynamic(() => import("./trip-comparison").then((module) => module.TripComparison), { ssr: false, loading: toolLoading });
const CommunityShare = dynamic(() => import("./community-share").then((module) => module.CommunityShare), { ssr: false, loading: toolLoading });

export function PlanWorkspace() {
  const { draft, updateDraft, ready, persistent, now } = useDraft();
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(0);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reading = readingView(draft.selection, now);
  const plan = draft.plan;
  const time = plan ? displayPlanTime(plan.time) : null;
  const initial = initialPlan(plan, draft.selection);

  function clearData() {
    updateDraft(() => emptyDraft);
    clearDialog.current?.close();
    setEditor((value) => value + 1);
    setNotice("Saved data cleared.");
    heading.current?.focus();
  }

  return (
    <main className="shell journal-shell planner-shell" id="main-content">
      <div className="planner-heading">
        <h1 ref={heading} tabIndex={-1}>My Plan</h1>
        <p>Keep your fixed commitments and make room for changes at home, on the way, and with your group.</p>
      </div>

      <nav className="plan-nav" aria-label="Planning tools">
        <PlanLink to="schedule">Schedule</PlanLink>
        <PlanLink to="preferences">Preferences</PlanLink>
        <PlanLink to="routes">Travel</PlanLink>
        <PlanLink to="community">Group note</PlanLink>
      </nav>

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
          <AppLink href="/">{reading ? "View reading details" : "Add a reading"}</AppLink>
        </div>
      </section>

      <PlanEditor key={`plan-${editor}`} initial={initial} ready={ready} onSave={(next) => {
        updateDraft((current) => ({ ...current, plan: next }));
        setNotice("Plan updated.");
      }} />
      <p role="status" className="form-notice schedule-notice">{notice}</p>
      <PlanningActions result={planningActions(draft.preferences, reading, plan)} />
      <div className="plan-tools">
        <PlanTool id="preferences" title="Adjust preferences" description="Tell AirDaybook which options are available to you.">
          <PlanPreferences key={`preferences-${editor}`} />
        </PlanTool>
        <PlanTool id="routes" title="Compare two routes" description="See time outdoors, total travel and the Metro CO₂ estimate.">
          <TripComparison key={`routes-${editor}`} saved={draft.travel} ready={ready} onSave={(travel) => {
            updateDraft((current) => ({ ...current, travel }));
          }} />
        </PlanTool>
        <PlanTool id="community" title="Write a group note" description="Share a dated reading in English or Hindi.">
          <CommunityShare key={`share-${editor}`} selection={draft.selection} now={now} ready={ready} />
        </PlanTool>
      </div>
      <div className="plan-footer">
        <div>
          <p>{persistent ? "Your reading and plan stay on this device." : "Draft storage is unavailable. Your changes last until you close or reload this page."}</p>
        </div>
        <button className="button button-subtle" disabled={!ready || (!draft.selection && !plan && !draft.previousPreferences && !draft.travel)} onClick={() => clearDialog.current?.showModal()}><Trash2 size={16} aria-hidden /> Clear saved data</button>
      </div>
      <dialog className="entry-dialog clear-dialog" ref={clearDialog} aria-labelledby="clear-title">
        <div className="dialog-top">
          <div><h2 id="clear-title">Clear saved data?</h2><p>This removes the selected reading, plan, preferences and route comparison from this device.</p></div>
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
