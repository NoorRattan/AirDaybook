"use client";

import { useLocale } from "./locale";

import { Clock3, Radio, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { emptyDraft, hasSavedWorkspaceData } from "@/lib/draft";
import { displayPlanTime, initialPlan } from "@/lib/plan";
import { planningActions } from "@/lib/planning-actions";
import { readingView } from "@/lib/readings";
import { AppLink } from "./app-link";
import { useDraftActions, useDraftState, useReadingClock } from "./draft-provider";
import { PlanningActions } from "./planning-actions";
import { PlanTool } from "./plan-tool";
import { PlanEditor } from "./plan-editor";
import { PlanLink } from "./plan-link";
import { CareHelp } from "./care-help";
import { PlanPreferences } from "./plan-preferences";

const toolLoading = () => <p role="status">Opening tool…</p>;
const TripComparison = dynamic(() => import("./trip-comparison").then((module) => module.TripComparison), { ssr: false, loading: toolLoading });
const CommunityShare = dynamic(() => import("./community-share").then((module) => module.CommunityShare), { ssr: false, loading: toolLoading });
const RoutinePlanner = dynamic(() => import("./routine-planner").then((module) => module.RoutinePlanner), { ssr: false, loading: toolLoading });
const IndoorToolkit = dynamic(() => import("./routine-planner").then((module) => module.IndoorToolkit), { ssr: false, loading: toolLoading });

export function PlanWorkspace() {
  const { t } = useLocale();
  const { draft, ready, persistent } = useDraftState();
  const { updateDraft } = useDraftActions();
  const now = useReadingClock(draft.selection);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(0);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reading = readingView(draft.selection, now);
  const plan = draft.plan;
  const time = plan ? displayPlanTime(plan.time) : null;
  const initial = initialPlan(plan, draft.selection);
  const advice = planningActions(draft.preferences, reading, plan);
  const solidFuel = draft.routine?.solidFuel === true;

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
        <h1 ref={heading} tabIndex={-1}>{t("My Plan")}</h1>
        <p>{t("Keep your fixed commitments and make room for changes at home, on the way, and with your group.")}</p>
      </div>

      <nav className="plan-nav" aria-label="Planning tools">
        <PlanLink to="schedule">{t("Schedule")}</PlanLink>
        <PlanLink to="routine">{t("Daily routine")}</PlanLink>
        <PlanLink to="indoor">{t("Indoor air")}</PlanLink>
        <PlanLink to="preferences">{t("Preferences")}</PlanLink>
        <PlanLink to="routes">{t("Travel")}</PlanLink>
        <PlanLink to="community">{t("Group note")}</PlanLink>
      </nav>
      {solidFuel && <CareHelp solidFuel />}

      <section className="commitment-band" aria-labelledby="fixed-time-display">
        <div>
          <h2 className="eyebrow" id="fixed-time-display"><Clock3 size={17} aria-hidden /> {t("Fixed commitment")}</h2>
          {time ? (
            <>
              <p className="plan-clock">{time.clock} <span>{time.meridiem}</span></p>
              <p className="plan-commitment">{plan?.commitment}</p>
            </>
          ) : <p className="plan-clock unset">{t("No time saved.")}</p>}
        </div>
        <div className="plan-reading">
          <span className="eyebrow"><Radio size={16} aria-hidden /> {t("Selected reading")}</span>
          <strong>{reading ? `${reading.place} · ${reading.value} ${reading.unit}` : t("No reading selected")}</strong>
          {reading && <p>{t(reading.state)} · {reading.time}</p>}
          <AppLink href="/">{t(reading ? "View reading details" : "Add a reading")}</AppLink>
        </div>
      </section>

      <PlanEditor key={`plan-${editor}`} initial={initial} ready={ready} onSave={(next) => {
        updateDraft((current) => ({ ...current, plan: next }));
        setNotice("Plan updated.");
      }} />
      <p role="status" className="form-notice schedule-notice">{t(notice)}</p>
      <section className="plan-tool assistant-panel" id="preferences" aria-labelledby="assistant-title" tabIndex={-1}>
        <h2 className="section-title" id="assistant-title">{t("Day-plan assistant")}</h2>
        <PlanPreferences key={`preferences-${editor}`} />
      </section>
      <PlanningActions result={solidFuel ? { ...advice, actions: advice.actions.filter(({ area }) => area !== "home") } : advice} />
      <div className="plan-tools">
        <PlanTool id="routine" title={t("Plan your daily routine")} description={t("Compare usual activities with suggested changes while keeping fixed times.")}>
          <RoutinePlanner key={`routine-${editor}`} reading={reading} />
        </PlanTool>
        <PlanTool id="indoor" title={t("Improve indoor air")} description={t("Compare practical source-control and filter options.")}>
          <IndoorToolkit key={`indoor-${editor}`} solidFuel={solidFuel} />
        </PlanTool>
        <PlanTool id="routes" title={t("Compare two routes")} description={t("See time outdoors, total travel and the Metro CO₂ estimate.")}>
          <TripComparison key={`routes-${editor}`} saved={draft.travel} ready={ready} onSave={(travel) => {
            updateDraft((current) => ({ ...current, travel }));
          }} />
        </PlanTool>
        <PlanTool id="community" title={t("Write a group note")} description={t("Share a dated reading in English or Hindi.")}>
          <CommunityShare key={`share-${editor}`} selection={draft.selection} now={now} ready={ready} travel={draft.travel} />
        </PlanTool>
      </div>
      {!solidFuel && <CareHelp />}
      <div className="plan-footer">
        <div>
          <p>{t(persistent ? "Your reading and plan stay on this device." : "Draft storage is unavailable. Your changes last until you close or reload this page.")}</p>
        </div>
        <button className="button button-subtle" disabled={!ready || !hasSavedWorkspaceData(draft)} onClick={() => clearDialog.current?.showModal()}><Trash2 size={16} aria-hidden /> {t("Clear saved data")}</button>
      </div>
      <dialog className="entry-dialog clear-dialog" ref={clearDialog} aria-labelledby="clear-title">
        <div className="dialog-top">
          <div><h2 id="clear-title">{t("Clear saved data?")}</h2><p>{t("This removes the selected reading, plan, daily routine, preferences and route comparison from this device.")}</p></div>
          <button type="button" aria-label={t("Close")} className="icon-button" onClick={() => clearDialog.current?.close()}><X size={22} aria-hidden /></button>
        </div>
        <div className="form-actions">
          <button className="button button-subtle" onClick={() => clearDialog.current?.close()}>{t("Cancel")}</button>
          <button className="button button-primary" onClick={clearData}>{t("Clear reading and plan")}</button>
        </div>
      </dialog>
    </main>
  );
}
