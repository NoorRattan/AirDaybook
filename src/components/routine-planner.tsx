"use client";

import { useLocale } from "./locale";

import { useState, type FormEvent } from "react";
import { emptyRoutine, particleAirflow, routineAdvice, routineBlockSchema, type Routine } from "@/lib/routine";
import { maxRoutineBlocks } from "@/lib/routine-intake";
import type { readingView } from "@/lib/readings";
import { useDraftActions, useDraftState } from "./draft-provider";
import { CareHelp } from "./care-help";

const advisory = "https://ncdc.mohfw.gov.in/uploads/pdf/Enclosure%201.%20DO%20letter%20from%20Secretary%2C%20DoHFW%20to%20CS_AP%20Advisory_2025.pdf";
const conditions = [
  ["extraPrecautions", "Extra precautions for household members who are more affected by air pollution"],
  ["solidFuel", "Open wood, coal or charcoal heating inside"],
  ["outdoorWork", "Outdoor work that cannot be moved"],
  ["community", "Planning for a school, workplace or residential group"],
] as const;

export function RoutinePlanner({ reading }: { reading: ReturnType<typeof readingView> }) {
  const { t, language } = useLocale();
  const { draft, ready } = useDraftState();
  const { updateDraft } = useDraftActions();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const routine = draft.routine ?? emptyRoutine;
  const result = routineAdvice(routine, reading, draft.preferences.canMoveActivityIndoors === true, language);

  function save(update: (routine: Routine) => Routine) {
    updateDraft((current) => {
      const next = update(current.routine ?? emptyRoutine);
      return { ...current, routine: next.blocks.length || conditions.some(([key]) => next[key]) ? next : null };
    });
  }

  function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || routine.blocks.length >= maxRoutineBlocks) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const block = routineBlockSchema.safeParse({
      id: crypto.randomUUID(), name: fields.get("activity"), time: fields.get("time"),
      minutes: Number(fields.get("minutes")), fixed: fields.has("fixed"),
      outdoors: fields.has("outdoors"), strenuous: fields.has("strenuous"),
    });
    if (!block.success) {
      setError("Enter an activity name, a valid time and a duration of 1–720 minutes.");
      return;
    }
    save((current) => current.blocks.length >= maxRoutineBlocks ? current : { ...current, blocks: [...current.blocks, block.data] });
    form.reset();
    setError("");
    setNotice("Activity added.");
  }

  return (
    <section className="routine-planner">
      <fieldset className="routine-options" disabled={!ready}>
        <legend>{t("Local planning preferences")}</legend>
        <p className="muted">{t("These selections stay on this device.")}</p>
        {conditions.map(([key, label]) => (
          <label key={key} className="check-label">
            <input type="checkbox" checked={routine[key]} onChange={(event) => {
              const { checked } = event.target;
              save((current) => ({ ...current, [key]: checked }));
            }} /> {t(label)}
          </label>
        ))}
      </fieldset>
      {reading?.kind === "historical" && <p className="muted">{t("The guidance below uses the historical replay.")}</p>}
      <p>{result.guidance} <a className="routine-source" href={advisory} target="_blank" rel="noopener noreferrer">{t("NCDC guidance")}</a></p>
      {result.high && routine.outdoorWork && <p>If outdoor work is essential, take breaks away from heavy traffic or dust where practical and follow workplace safety requirements.</p>}
      {routine.community && <p>Coordinate shared trips and choose indoor space for flexible gatherings where available.</p>}
      <form className="plan-form" onSubmit={addBlock}>
        <fieldset disabled={!ready || routine.blocks.length >= maxRoutineBlocks}>
          <legend>{t("Add an activity")}</legend>
          <div className="routine-fields">
            <label>{t("Activity")}<input name="activity" required maxLength={100} placeholder={t("e.g. Evening walk")} /></label>
            <label>{t("Start time")}<input name="time" type="time" required /></label>
            <label>{t("Minutes")}<input name="minutes" type="number" required min={1} max={720} /></label>
          </div>
          <div className="routine-flags">
            <label className="check-label"><input name="fixed" type="checkbox" /> {t("Fixed")}</label>
            <label className="check-label"><input name="outdoors" type="checkbox" /> {t("Outdoors")}</label>
            <label className="check-label"><input name="strenuous" type="checkbox" /> {t("Strenuous")}</label>
          </div>
          <button className="button button-primary" type="submit">{t("Add to routine")}</button>
        </fieldset>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
      </form>
      <p role="status" className="form-notice">{t(notice)}</p>
      {result.blocks.length > 0 && (
        <>
          <h3>{t("Usual routine and suggested changes")}</h3>
          <ul className="routine-timeline">
            {result.blocks.map((block) => (
              <li key={block.id}>
                <div><strong>{block.time} · {block.name}</strong><p>{block.minutes} {t("min")} · {t(block.outdoors ? "Outdoors" : "Indoors")} · {t(block.fixed ? "Fixed time" : "Flexible")}{block.moveInside ? ` → ${t("Move indoors")}` : ""}</p></div>
                <button className="button button-subtle" type="button" aria-label={t("Remove {activity} at {time}").replace("{time}", block.time).replace("{activity}", () => block.name)} onClick={() => {
                  save((current) => ({ ...current, blocks: current.blocks.filter(({ id }) => id !== block.id) }));
                  setNotice("Activity removed.");
                }}>{t("Remove")}</button>
              </li>
            ))}
          </ul>
          <p><strong>{t("Outdoor time for these activities")}</strong> {result.outdoorMinutes} → {result.outdoorMinutes - result.removedMinutes} {t("min")}. {t("Strenuous outdoor time moved indoors")} {result.strenuousMinutes} {t("min")}.</p>
        </>
      )}
    </section>
  );
}

export function IndoorToolkit({ solidFuel }: { solidFuel: boolean }) {
  const { t } = useLocale();
  const [area, setArea] = useState("");
  const [height, setHeight] = useState("");
  const [changes, setChanges] = useState("5");
  const cadr = particleAirflow(Number(area), Number(height), Number(changes));
  if (solidFuel) return <CareHelp solidFuel />;
  return (
    <section className="routine-planner">
      <ul className="routine-timeline">
        <li><div><strong>{t("Reduce smoke at the source")}</strong><p>{t("Skip indoor incense, coils and smoking. Use an exhaust fan that vents outdoors when cooking, and avoid charring food.")}</p></div></li>
        <li><div><strong>{t("Check conditions before airing")}</strong><p>{t("Look up the current reading before opening windows for routine airing. Keep required cooking and appliance ventilation available.")}</p></div></li>
        <li><div><strong>{t("Use one room for particle filtration")}</strong><p>{t("Run a purifier sized for the room you use most. Follow the device’s filter maintenance instructions and avoid units that intentionally produce ozone.")}</p></div></li>
        <li><div><strong>{t("Clean settled dust with a damp cloth or mop")}</strong><p>{t("Damp cleaning keeps settled particles from going back into the air.")}</p><a className="routine-source" href="https://www.epa.gov/emergencies-iaq/create-clean-room-protect-indoor-air-quality-during-wildfire" target="_blank" rel="noopener noreferrer">{t("EPA cleaner-air room guidance")}</a></div></li>
        <li><div><strong>{t("Compare a low-cost filter")}</strong><p>{t("EPA publishes MERV 13 box-fan designs and electrical safety considerations. Use equipment rated for your local power supply.")}</p><a className="routine-source" href="https://www.epa.gov/emergencies-iaq/diy-air-cleaners" target="_blank" rel="noopener noreferrer">{t("EPA instructions and safety checks")}</a></div></li>
      </ul>
      <fieldset>
        <legend>{t("Calculate particle clean-air delivery")}</legend>
        <div className="routine-fields">
          <label>{t("Room area (m²)")}<input type="number" value={area} min={1} max={500} onChange={(event) => setArea(event.target.value)} /></label>
          <label>{t("Ceiling height (m)")}<input type="number" value={height} min={0.5} max={20} step="0.1" onChange={(event) => setHeight(event.target.value)} /></label>
          <label>{t("Target air changes per hour")}<input type="number" value={changes} min={1} max={20} onChange={(event) => setChanges(event.target.value)} /></label>
        </div>
        {cadr !== null && <p><strong>{cadr} m³/h</strong> {t("estimated particle CADR at your selected air-change target.")}</p>}
        <a className="routine-source" href="https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home" target="_blank" rel="noopener noreferrer">{t("EPA room sizing and filter guidance")}</a>
      </fieldset>
    </section>
  );
}
