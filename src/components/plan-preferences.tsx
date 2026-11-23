"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Draft } from "@/lib/draft";
import { preferenceKeys, preferenceLabel, preferenceLabels, type PreferenceKey } from "@/lib/preferences";
import type { RevisionResponse } from "@/lib/revision-schema";
import { useDraft } from "./draft-provider";

type Proposal = { base: Draft; revision: RevisionResponse };

const failureMessages: Record<string, string> = {
  invalid_request: "Check that your update has 1–500 characters.",
  payload_too_large: "Shorten the update and try again.",
  usage_limited: "The AI request limit has been reached. You can still change preferences here.",
  provider_timeout: "The suggestion timed out. Try again or use the preference controls.",
};
const unavailable = "AI suggestions are unavailable. You can still change preferences here.";

export function PlanPreferences() {
  const { draft, updateDraft, ready } = useDraft();
  const [text, setText] = useState("");
  const [online, setOnline] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const request = useRef<AbortController | null>(null);
  const visibleProposal = proposal?.base === draft ? proposal : null;

  useEffect(() => {
    const updateConnectivity = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) request.current?.abort();
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
    setAvailable(null);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);
    fetch("/api/v1/revisions", { signal, cache: "no-store" })
      .then(async (response) => response.ok && (await response.json())?.available === true)
      .then((enabled) => { if (!controller.signal.aborted) setAvailable(enabled); })
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, [online]);

  function setPreference(key: PreferenceKey, value: boolean | null) {
    setProposal(null);
    setNotice("");
    updateDraft((current) => current.preferences[key] === value ? current : {
      ...current, previousPreferences: current.preferences,
      preferences: { ...current.preferences, [key]: value },
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || request.current || !online || !available) return;
    const update = text.trim();
    if (!update || Array.from(update).length > 500) {
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
        body: JSON.stringify({ revisionId, text: update, preferences: draft.preferences }),
        cache: "no-store",
        signal: controller.signal,
      });
      const data: unknown = await reply.json();
      if (controller.signal.aborted) return;
      if (!reply.ok) {
        const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
        const retryAfter = Number(reply.headers.get("Retry-After"));
        const message = typeof code === "string" && Object.hasOwn(failureMessages, code)
          ? failureMessages[code] : unavailable;
        setNotice(code === "usage_limited" && Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 86400
          ? `${message} Try again in about ${Math.ceil(retryAfter / 60)} min.` : message);
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
        setNotice(parsed.data.outcome === "clarify"
          ? "Which preference should change? State what is available or possible."
          : "No preference changes found.");
      }
    } catch {
      if (!controller.signal.aborted) setNotice(unavailable);
    } finally {
      if (request.current === controller) request.current = null;
      setPending(false);
    }
  }

  async function apply() {
    if (!visibleProposal) return;
    const { revisionResponseSchema, hasEffectivePreferenceChanges } = await import("@/lib/revision-schema");
    const parsed = revisionResponseSchema.safeParse(visibleProposal.revision);
    if (!parsed.success || !hasEffectivePreferenceChanges(parsed.data.changes, draft.preferences)) return;
    const changes = parsed.data.changes;
    updateDraft((current) => current !== visibleProposal.base ? current : {
      ...current, previousPreferences: current.preferences,
      preferences: { ...current.preferences, ...changes },
    });
    setProposal(null);
    setNotice("Preferences updated.");
  }

  return (
    <section className="preferences-workbench" aria-labelledby="preferences-title">
      <h2 className="sr-only" id="preferences-title">Plan preferences</h2>
      <div className="preferences-grid">
        <div className="preference-fields">
          {preferenceKeys.map((key) => (
            <label key={key}>
              {preferenceLabels[key]}
              <select
                value={String(draft.preferences[key])} disabled={!ready}
                onChange={(event) => setPreference(key, event.target.value === "null" ? null : event.target.value === "true")}
              >
                <option value="null">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              {draft.previousPreferences && draft.previousPreferences[key] !== draft.preferences[key] &&
                <span className="muted">Previously {preferenceLabel(draft.previousPreferences[key]).toLowerCase()}</span>}
            </label>
          ))}
        </div>
        <div className="preference-suggestions">
          {online && available === true && <form onSubmit={submit} className="revision-form">
            <label htmlFor="plan-update">What changed?</label>
            <textarea id="plan-update" rows={3} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} aria-describedby="revision-disclosure" placeholder="We don’t have a purifier or Metro access." />
            <p className="muted" id="revision-disclosure">Your submitted text and these four preferences go to Groq. Leave out names, addresses and medical details.</p>
            <button className="button button-primary" type="submit" disabled={!ready || !online || pending || !text.trim()}>
              {pending ? "Checking the update…" : "Suggest preference changes"}
            </button>
          </form>}
          <p role="status" className="form-notice">{!online ? "AI suggestions require an internet connection." : available === false ? unavailable : available === null ? "Checking AI availability…" : notice}</p>
          {online && available === true && visibleProposal && (
            <div className="revision-preview" aria-label="Suggested changes">
              <h3>Review the proposed changes</h3>
              <ul>
                {preferenceKeys.map((key) => {
                  const value = visibleProposal.revision.changes[key];
                  return value === undefined ? null : <li key={key}><span>{preferenceLabels[key]}</span><strong>{preferenceLabel(value)}</strong></li>;
                })}
              </ul>
              <div className="form-actions">
                <button type="button" className="button button-subtle" onClick={() => { setProposal(null); setNotice("Suggestion discarded."); }}>Discard</button>
                <button type="button" className="button button-primary" onClick={() => void apply()}>Apply changes</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
