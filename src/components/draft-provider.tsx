"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { emptyDraft, readDraft, writeDraft, type Draft } from "@/lib/draft";

const DraftContext = createContext<{
  draft: Draft;
  updateDraft: (update: (current: Draft) => Draft) => void;
  finishDraftWrite: () => Promise<void>;
  ready: boolean;
  persistent: boolean;
  now: number;
} | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [now, setNow] = useState(0);
  const scheduled = useRef<Draft>(emptyDraft);
  const pendingWrite = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    readDraft().then(
      (saved) => {
        if (active) {
          scheduled.current = saved;
          setDraft(saved);
        }
      },
      () => { if (active) setPersistent(false); },
    ).finally(() => {
      if (active) {
        setNow(Date.now());
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draft.selection || draft.selection === "replay") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [draft.selection]);

  useLayoutEffect(() => {
    if (!ready || !persistent || draft === scheduled.current) return;
    const previous = scheduled.current;
    scheduled.current = draft;
    pendingWrite.current = pendingWrite.current
      .then(() => writeDraft(previous, draft))
      .catch(() => { setPersistent(false); });
  }, [draft, ready, persistent]);

  return (
    <DraftContext.Provider value={{ draft, updateDraft: setDraft, finishDraftWrite: () => pendingWrite.current, ready, persistent, now }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const draft = useContext(DraftContext);
  if (!draft) throw new Error("DraftProvider is required.");
  return draft;
}
