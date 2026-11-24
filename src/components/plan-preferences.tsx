"use client";

import { useLocale } from "./locale";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Draft } from "@/lib/draft";
import { containsContactDetails, safeMultilineText } from "@/lib/input-text";
import { initialPlan } from "@/lib/plan";
import { preferenceKeys, preferenceLabel, preferenceLabels, type PreferenceKey } from "@/lib/preferences";
import type { RevisionResponse } from "@/lib/revision-schema";
import { emptyRoutine } from "@/lib/routine";
import { availableDraftActivities, draftActivities } from "@/lib/routine-intake";
import { useDraftActions, useDraftState } from "./draft-provider";
import { PlanLink } from "./plan-link";

type Proposal = { base: Draft; revision: RevisionResponse };
type Availability = "checking" | "enabled" | "disabled" | "retry";
const maxUpdateLength = 500;
const sampleRoutine = "Evening walk at 18:00 for 30 minutes outdoors, flexible; Dinner at 20:00 for 45 minutes indoors, fixed";

const failureMessages: Record<string, string> = {
  invalid_request: "Check that your update has 1–500 characters.",
  payload_too_large: "Shorten the update and try again.",
  usage_limited: "The AI request limit has been reached. You can still change preferences here.",
  provider_timeout: "The suggestion timed out. Try again or use the preference controls.",
};
const unavailable = "AI suggestions are unavailable. You can still change preferences here.";
const tools = {
  routine: ["Plan your daily routine", "Compare activity options and keep your fixed times."],
  indoor: ["Improve indoor air", "Compare smoke sources, ventilation and particle filtration."],
  routes: ["Compare two routes", "Use travel time, outdoor waiting and costs you enter."],
  community: ["Write a group note", "Start from the selected reading and review an English or Hindi draft."],
} as const;
const prompts = [
  ["Indoor air", "We don’t have a purifier. What can we do about indoor air?"],
  ["Travel", "Help me compare a carpool with Metro."],
  ["Group note", "Help me draft a Hindi group note."],
  ["Daily routine", "Help me move a flexible outdoor activity indoors."],
] as const;

function responseNotice(reply: Response, data: unknown, t: (text: string) => string) {
  const apiCode = (data as { error?: { code?: unknown } } | null)?.error?.code;
  const statusCode = reply.status === 429 ? "usage_limited"
    : reply.status === 504 ? "provider_timeout"
      : reply.status === 413 ? "payload_too_large" : null;
  const code = typeof apiCode === "string" && Object.hasOwn(failureMessages, apiCode) ? apiCode : statusCode;
  const message = code ? failureMessages[code] : unavailable;
  const retryAfter = Number(reply.headers.get("Retry-After"));
  return code === "usage_limited" && Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 86400
    ? `${t(message)} ${t("Try again in about {minutes} min.").replace("{minutes}", String(Math.ceil(retryAfter / 60)))}` : message;
}

export function PlanPreferences() {
  const { t } = useLocale();
  const { draft, ready } = useDraftState();
  const { updateDraft, finishDraftWrite } = useDraftActions();
  const [text, setText] = useState("");
  const [includeActivities, setIncludeActivities] = useState(false);
  const [online, setOnline] = useState(true);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const request = useRef<AbortController | null>(null);
  const visibleProposal = proposal?.base === draft ? proposal : null;
  const updateLength = Array.from(text.trim()).length;
  const sensitive = containsContactDetails(text);
  const invalidText = !safeMultilineText(text);
  const validUpdate = updateLength > 0 && updateLength <= maxUpdateLength && !sensitive && !invalidText;
  const canUseAi = online && availability === "enabled";
  const activities = visibleProposal?.revision.activities ?? [];
  const eligible = availableDraftActivities(activities, draft.routine?.blocks ?? [], initialPlan(draft.plan, draft.selection));
  const hasChanges = visibleProposal && preferenceKeys.some((key) => {
    const value = visibleProposal.revision.changes[key];
    return value !== undefined && value !== draft.preferences[key];
  });

  useEffect(() => {
    const updateConnectivity = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        setAvailability("checking");
        request.current?.abort();
      }
    };
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  useEffect(() => () => request.current?.abort(), [draft]);

  useEffect(() => {
    if (!online || !navigator.onLine) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);
    fetch("/api/v1/revisions", { signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || typeof data?.available !== "boolean") return "retry";
        return data.available ? "enabled" : "disabled";
      })
      .then((status) => { if (!controller.signal.aborted) setAvailability(status); })
      .catch(() => { if (!controller.signal.aborted) setAvailability("retry"); });
    return () => controller.abort();
  }, [online, attempt]);

  function setPreference(key: PreferenceKey, value: boolean | null) {
    setProposal(null);
    setNotice("");
    updateDraft((current) => current.preferences[key] === value ? current : {
      ...current, previousPreferences: current.preferences,
      preferences: { ...current.preferences, [key]: value },
    });
  }

  function editText(value: string) {
    setText(value);
    setNotice("");
    setProposal(null);
    request.current?.abort();
  }

  function draftOnDevice() {
    if (!ready || !validUpdate || pending) return;
    const activities = draftActivities(text);
    setProposal(activities.length ? {
      base: draft, revision: { revisionId: crypto.randomUUID(), outcome: "apply", changes: {}, activities },
    } : null);
    setNotice(activities.length ? "Suggestion ready to review." : "No activities found. Include a start time, duration and indoor or outdoor location.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || request.current || !canUseAi) return;
    const update = text.trim();
    if (!validUpdate) {
      setNotice(failureMessages.invalid_request);
      return;
    }
    setProposal(null);
    setNotice("");
    const controller = new AbortController();
    request.current = controller;
    setPending(true);

    try {
      const revisionId = crypto.randomUUID();
      const reply = await fetch("/api/v1/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId, text: update, preferences: draft.preferences, assistant: true,
          ...(includeActivities ? { routineDraft: true } : {}) }),
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
      });
      const data: unknown = await reply.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!reply.ok) {
        setNotice(responseNotice(reply, data, t));
        return;
      }
      const { revisionResponseSchema } = await import("@/lib/revision-schema");
      if (controller.signal.aborted) return;
      const parsed = revisionResponseSchema.safeParse(data);
      if (!parsed.success || parsed.data.revisionId !== revisionId) {
        setNotice(unavailable);
      } else if (parsed.data.outcome === "apply") {
        setProposal({ base: draft, revision: parsed.data });
        setNotice("Suggestion ready to review.");
      } else {
        setNotice(includeActivities ? "No activities or preference changes found. Try the sample format."
          : parsed.data.outcome === "clarify"
          ? "Which preference should change? State what is available or possible."
          : "No preference changes found.");
      }
    } catch {
      if (!controller.signal.aborted) setNotice(unavailable);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  async function apply() {
    if (!visibleProposal || (!hasChanges && !eligible.length)) return;
    const { changes } = visibleProposal.revision;
    const blocks = eligible.map((activity) => ({ ...activity, id: crypto.randomUUID() }));
    let applied = false;
    updateDraft((current) => {
      if (current !== visibleProposal.base) return current;
      applied = true;
      const routine = current.routine ?? emptyRoutine;
      return {
        ...current,
        ...(hasChanges ? { previousPreferences: current.preferences, preferences: { ...current.preferences, ...changes } } : {}),
        ...(blocks.length ? { routine: { ...routine, blocks: [...routine.blocks, ...blocks] } } : {}),
      };
    });
    setProposal(null);
    setNotice("");
    if (applied) {
      await finishDraftWrite();
      setNotice(blocks.length ? "Activities added to your routine." : "Preferences updated.");
    } else {
      setNotice("Your plan changed. Request a new suggestion to review.");
    }
  }

  let status = notice;
  if (pending) status = "Checking the update…";
  else if (!notice) {
    if (!online) status = "AI suggestions require an internet connection.";
    else if (availability === "checking") status = "Checking AI availability…";
    else if (availability !== "enabled") status = unavailable;
  }

  return (
    <div className="preferences-workbench">
      <div className="preferences-grid">
        <div className="preference-fields">
          {preferenceKeys.map((key) => (
            <label key={key}>
              {t(preferenceLabels[key])}
              <select
                value={String(draft.preferences[key])} disabled={!ready}
                onChange={(event) => setPreference(key, event.target.value === "null" ? null : event.target.value === "true")}
              >
                <option value="null">{t("Not set")}</option>
                <option value="true">{t("Yes")}</option>
                <option value="false">{t("No")}</option>
              </select>
              {draft.previousPreferences && draft.previousPreferences[key] !== draft.preferences[key] &&
                <span className="muted">{t("Previously {value}").replace("{value}", t(preferenceLabel(draft.previousPreferences[key])).toLocaleLowerCase())}</span>}
            </label>
          ))}
        </div>
        <div className="preference-suggestions">
          <form onSubmit={submit} className="revision-form" aria-busy={pending}>
            <label htmlFor="plan-update">{t("What changed?")}</label>
            <textarea id="plan-update" rows={3} maxLength={1000} value={text} onChange={(event) => editText(event.target.value)} aria-invalid={updateLength > maxUpdateLength || sensitive || invalidText || undefined} aria-describedby={`revision-disclosure revision-length${sensitive || invalidText ? " revision-privacy" : ""}`} placeholder={t(canUseAi ? "We don’t have a purifier or Metro access." : sampleRoutine)} />
            {canUseAi && <div className="routine-flags">
              {prompts.map(([label, prompt]) => <button type="button" key={label} className="button button-subtle" onClick={() => { editText(t(prompt)); setIncludeActivities(false); }}>{t(label)}</button>)}
            </div>}
            {canUseAi && <label className="check-label"><input type="checkbox" checked={includeActivities} disabled={pending} onChange={(event) => setIncludeActivities(event.target.checked)} /> {t("Include routine activities in the suggestion")}</label>}
            <div className="form-actions">
              <button type="button" className="button button-subtle" onClick={() => { editText(t(sampleRoutine)); setIncludeActivities(true); }}>{t("Use a sample routine")}</button>
              <button type="button" className="button button-subtle" disabled={!ready || !validUpdate || pending} onClick={draftOnDevice}>{t("Draft activities on this device")}</button>
            </div>
            <p className={updateLength > maxUpdateLength ? "form-error" : "muted"} id="revision-length">{updateLength} / {maxUpdateLength} {t("characters")}</p>
            <p className="muted" id="revision-disclosure">{t(canUseAi ? "AI sends only your submitted text and the four preferences to Groq. Leave out names, addresses and medical details." : "Drafting on this device keeps your text in this browser.")}</p>
            <p className={sensitive || invalidText ? "form-error" : "sr-only"} role="alert" id="revision-privacy">{sensitive || invalidText ? t(sensitive ? "Remove phone, email or ID details before sending." : "Remove invisible control characters before sending.") : ""}</p>
            {canUseAi && <button className="button button-primary" type="submit" disabled={!ready || pending || !validUpdate}>
              {t(pending ? "Checking the update…" : includeActivities ? "Suggest a routine draft" : "Suggest preference changes")}
            </button>}
          </form>
          <p className="form-notice">{t(status)}</p>
          <p className="sr-only" role="status">{notice ? t(notice) : ""}</p>
          {online && availability === "retry" && <button type="button" className="button button-subtle" onClick={() => {
            setAvailability("checking");
            setAttempt((value) => value + 1);
          }}>{t("Retry AI availability")}</button>}
          {visibleProposal && (
            <section className="revision-preview" aria-labelledby="revision-preview">
              <h3 id="revision-preview">{t("Review the proposed changes")}</h3>
              {hasChanges && <ul>
                {preferenceKeys.map((key) => {
                  const value = visibleProposal.revision.changes[key];
                  return value === undefined ? null : <li key={key}><span>{t(preferenceLabels[key])}</span><strong>{t(preferenceLabel(value))}</strong></li>;
                })}
              </ul>}
              {eligible.length > 0 && <ul>
                {eligible.map((activity) => <li key={`${activity.time}-${activity.name}`}><span>{activity.name}</span><strong>{activity.time} · {activity.minutes} {t("min")} · {t(activity.outdoors ? "Outdoors" : "Indoors")} · {t(activity.fixed ? "Fixed time" : "Flexible")}</strong></li>)}
              </ul>}
              {eligible.length < activities.length && <p>{t("Some activities could not fit around saved times, the end of the day or the routine limit.")}</p>}
              {visibleProposal.revision.tool && <p>{t(tools[visibleProposal.revision.tool][1])}</p>}
              <div className="form-actions">
                <button type="button" className="button button-subtle" onClick={() => { setProposal(null); setNotice("Suggestion discarded."); }}>{t("Discard")}</button>
                {(hasChanges || eligible.length > 0) && <button type="button" className="button button-primary" onClick={apply}>{t("Apply changes")}</button>}
                {visibleProposal.revision.tool && <PlanLink className="button button-subtle" to={visibleProposal.revision.tool}>{t(tools[visibleProposal.revision.tool][0])}</PlanLink>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
