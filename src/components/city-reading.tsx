"use client";

import { useLocale } from "./locale";

import { useState, type FormEvent } from "react";
import { cityPresets } from "@/lib/city-estimates";
import type { Observation } from "@/lib/readings";

export function CityReading({ ready, beginLookup }: { ready: boolean; beginLookup: () => (reading: Observation) => boolean }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    const city = new FormData(event.currentTarget).get("city");
    if (!navigator.onLine) {
      setStatus("City estimates need an internet connection. You can still enter a reading.");
      return;
    }
    const complete = beginLookup();
    setBusy(true);
    setStatus("Loading city estimate…");
    try {
      const reply = await fetch(`/api/v1/aqi?city=${encodeURIComponent(String(city))}`, { signal: AbortSignal.timeout(6500) });
      if (!reply.ok) throw new Error("Estimate unavailable");
      const { validateObservation } = await import("@/lib/observation-schema");
      const result = validateObservation(await reply.json());
      if (!("observation" in result)) throw new Error("Estimate unavailable");
      setStatus(complete(result.observation) ? "City estimate selected." : "");
    } catch {
      setStatus("The city estimate could not load. Try again or enter a reading from your source.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="city-lookup">
      <summary>{t("Find a city PM₂.₅ estimate")}</summary>
      <form onSubmit={lookup} aria-busy={busy}>
        <div><label htmlFor="lookup-city">{t("City")}</label><select id="lookup-city" name="city">{Object.entries(cityPresets).map(([value, [name]]) => <option key={value} value={value}>{name}</option>)}</select></div>
        <button className="button button-subtle" type="submit" disabled={busy || !ready}>{t("Load city estimate")}</button>
      </form>
      <p className="muted">{t("CAMS model estimate. Use CPCB for station measurements and Indian AQI.")}</p>
      <p className="form-notice" role="status">{status}</p>
    </details>
  );
}
