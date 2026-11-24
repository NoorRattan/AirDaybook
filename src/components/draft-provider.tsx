"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptyDraft, readDraft, writeDraft, type Draft } from "@/lib/draft";
import { sameDraftValue } from "@/lib/draft-merge";

const DraftContext = createContext<{
  draft: Draft;
  ready: boolean;
  persistent: boolean;
} | null>(null);
const DraftActionsContext = createContext<{
  updateDraft: (update: (current: Draft) => Draft) => void;
  finishDraftWrite: () => Promise<void>;
} | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const current = useRef<Draft>(emptyDraft);
  const canWrite = useRef(true);
  const pendingWrite = useRef(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);

  const showDraft = useCallback((saved: Draft) => {
    if (sameDraftValue(current.current, saved)) return;
    current.current = saved;
    setDraft(saved);
  }, []);
  const storageFailed = useCallback(() => {
    canWrite.current = false;
    setPersistent(false);
  }, []);

  useEffect(() => {
    const events = new AbortController();
    let refreshId = 0;
    async function refresh() {
      const id = ++refreshId;
      const queued = pendingWrite.current;
      await queued;
      if (!canWrite.current || events.signal.aborted) return;
      try {
        const saved = await readDraft();
        if (!events.signal.aborted && id === refreshId && pendingWrite.current === queued) showDraft(saved);
      } catch {
        if (!events.signal.aborted) storageFailed();
      } finally {
        if (!events.signal.aborted && id === refreshId) setReady(true);
      }
    }
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("airdaybook-draft");
      channel.current.onmessage = () => void refresh();
    }
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible, { signal: events.signal });
    window.addEventListener("pageshow", onVisible, { signal: events.signal });
    void refresh();
    return () => {
      events.abort();
      channel.current?.close();
      channel.current = null;
    };
  }, [showDraft, storageFailed]);

  const actions = useMemo(() => ({
    finishDraftWrite: () => pendingWrite.current,
    updateDraft(update: (draft: Draft) => Draft) {
      const previous = current.current;
      const next = update(previous);
      if (sameDraftValue(previous, next)) return;
      showDraft(next);
      if (!canWrite.current) return;
      const write = pendingWrite.current.then(async () => {
        if (!canWrite.current) return;
        const merged = await writeDraft(previous, next);
        if (pendingWrite.current === write) showDraft(merged);
        channel.current?.postMessage("draft-updated");
      }).catch(storageFailed);
      pendingWrite.current = write;
    },
  }), [showDraft, storageFailed]);
  const state = useMemo(() => ({ draft, ready, persistent }), [draft, ready, persistent]);

  return (
    <DraftActionsContext.Provider value={actions}>
      <DraftContext.Provider value={state}>{children}</DraftContext.Provider>
    </DraftActionsContext.Provider>
  );
}

export function useReadingClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export function useDraftActions() {
  const actions = useContext(DraftActionsContext);
  if (!actions) throw new Error("DraftProvider is required.");
  return actions;
}

export function useDraftState() {
  const draft = useContext(DraftContext);
  if (!draft) throw new Error("DraftProvider is required.");
  return draft;
}
