"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { useDraft } from "./draft-provider";

type Availability = "preparing" | "ready" | "unavailable";

function checkSavedFiles(worker: ServiceWorker, repair = false): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => finish(false), repair ? 30000 : 2500);
    function finish(ready: boolean) {
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(ready);
    }
    channel.port1.onmessage = (event: MessageEvent<{ ready?: boolean }>) => finish(event.data?.ready === true);
    try {
      worker.postMessage({ type: repair ? "REPAIR_CACHE" : "CACHE_STATUS" }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

export function OfflineStatus() {
  const { finishDraftWrite } = useDraft();
  const [availability, setAvailability] = useState<Availability>("preparing");
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) {
      setAvailability("unavailable");
      return;
    }

    const workers = navigator.serviceWorker;
    const activities = new AbortController();
    let idleTimer = 0;

    function syncAvailability() {
      if (activities.signal.aborted) return;
      const controller = workers.controller;
      setControlled(Boolean(controller));
      setWaiting(Boolean(controller && registration.current?.waiting));
      if (controller) {
        void checkSavedFiles(controller).then((ready) => {
          if (!activities.signal.aborted && workers.controller === controller) {
            setAvailability(ready ? "ready" : "unavailable");
          }
        });
      }
    }

    function observeInstalling() {
      const candidate = registration.current?.installing;
      if (!candidate) return;
      const changed = () => {
        if (candidate.state === "redundant" && !workers.controller) setAvailability("unavailable");
        syncAvailability();
      };
      candidate.addEventListener("statechange", changed, { signal: activities.signal });
      changed();
    }

    function start() {
      void workers.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((current) => {
        if (activities.signal.aborted) return;
        registration.current = current;
        current.addEventListener("updatefound", observeInstalling, { signal: activities.signal });
        observeInstalling();
        syncAvailability();
      }).catch(() => {
        if (activities.signal.aborted) return;
        if (workers.controller) syncAvailability();
        else setAvailability("unavailable");
      });
    }

    function scheduleStart() {
      idleTimer = window.setTimeout(start, 1500);
    }

    function controllerChanged() {
      if (updateRequested.current) {
        window.location.reload();
        return;
      }
      syncAvailability();
    }

    setOnline(navigator.onLine);
    workers.addEventListener("controllerchange", controllerChanged, { signal: activities.signal });
    window.addEventListener("offline", () => setOnline(false), { signal: activities.signal });
    window.addEventListener("online", () => {
      setOnline(true);
      void registration.current?.update().catch(() => {});
    }, { signal: activities.signal });
    syncAvailability();
    if (document.readyState === "complete") scheduleStart();
    else window.addEventListener("load", scheduleStart, { once: true, signal: activities.signal });

    return () => {
      activities.abort();
      window.clearTimeout(idleTimer);
    };
  }, []);

  async function loadUpdate() {
    const candidate = registration.current?.waiting;
    if (!candidate) return;
    setLoadingUpdate(true);
    await finishDraftWrite();
    try {
      updateRequested.current = true;
      candidate.postMessage({ type: "ACTIVATE_UPDATE" });
    } catch {
      updateRequested.current = false;
      setLoadingUpdate(false);
      setWaiting(Boolean(registration.current?.waiting));
    }
  }

  async function repairCache() {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return;
    setAvailability("preparing");
    const ready = await checkSavedFiles(controller, true);
    if (navigator.serviceWorker.controller === controller) setAvailability(ready ? "ready" : "unavailable");
  }

  if (process.env.NODE_ENV !== "production") return null;
  const status = availability === "ready" ? (online ? "Available offline" : "Offline mode")
    : availability === "preparing" ? "Preparing offline access" : "Offline access unavailable";
  return (
    <div className="offline-state">
      <p role="status">{online ? <Download size={15} aria-hidden /> : <WifiOff size={15} aria-hidden />}{status}</p>
      {waiting && (
        <button className="button button-subtle" type="button" disabled={loadingUpdate} onClick={() => void loadUpdate()}>
          <RefreshCw size={15} aria-hidden />{loadingUpdate ? "Loading update…" : "Load saved update"}
        </button>
      )}
      {online && availability === "unavailable" && controlled && !waiting && (
        <button className="button button-subtle" type="button" onClick={() => void repairCache()}>Retry offline download</button>
      )}
    </div>
  );
}
