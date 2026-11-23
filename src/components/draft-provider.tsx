"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { emptyDraft, readDraft, writeDraft, type Draft } from "@/lib/draft";

const DraftContext = createContext<{
  draft: Draft;
  updateDraft: (update: (current: Draft) => Draft) => void;
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
    ).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !persistent || draft === scheduled.current) return;
    scheduled.current = draft;
    let active = true;
    writeDraft(draft).catch(() => { if (active) setPersistent(false); });
    return () => { active = false; };
  }, [draft, ready, persistent]);

  return (
    <DraftContext.Provider value={{ draft, updateDraft: setDraft, ready, persistent, now }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const draft = useContext(DraftContext);
  if (!draft) throw new Error("DraftProvider is required.");
  return draft;
}
