"use client";

import { ArrowUpRight, Route } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { metroSavings, metroSources, tripTimes, type TravelComparison, type Trip } from "@/lib/travel";

const routeLabels = { current: "Current route", alternative: "Alternative route" } as const;
const timings = {
  walking: "Walking", waiting: "All waiting", outdoorWaiting: "Outside waiting", riding: "Riding",
} as const;
const modeLabels = { road: "Motorized road", metro: "Delhi Metro", "walk-cycle": "Walk or cycle", other: "Other" } as const;
const vehicleLabels = { open: "Open", enclosed: "Enclosed", mixed: "Mixed" } as const;
const trafficLabels = { light: "Light", heavy: "Heavy", mixed: "Mixed" } as const;

function RouteFields({ name, trip }: { name: keyof typeof routeLabels; trip?: Trip }) {
  return (
    <fieldset className="trip-leg">
      <legend>{routeLabels[name]}</legend>
      <label>Main mode
        <select name={`${name}.mode`} defaultValue={trip?.mode ?? ""}>
          <option value="">Select mode</option>
          {Object.entries(modeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <div className="time-inputs">
        {Object.entries(timings).map(([key, label]) => (
          <label key={key}>{label} (min)
            <input type="number" name={`${name}.${key}`} min={0} max={1440} step={1} inputMode="numeric" defaultValue={trip?.[key as keyof typeof timings] ?? ""} />
          </label>
        ))}
        <label>Vehicle
          <select name={`${name}.vehicle`} defaultValue={trip?.vehicle ?? ""}>
            <option value="">Unspecified</option>
            {Object.entries(vehicleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Traffic
          <select name={`${name}.traffic`} defaultValue={trip?.traffic ?? ""}>
            <option value="">Unspecified</option>
            {Object.entries(trafficLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function readRoute(fields: FormData, name: keyof typeof routeLabels) {
  const field = (key: keyof Trip) => fields.get(`${name}.${key}`) || null;
  const minutes = (key: keyof typeof timings) => {
    const value = field(key);
    return value === null ? null : Number(value);
  };
  return {
    mode: field("mode"), vehicle: field("vehicle"), traffic: field("traffic"),
    walking: minutes("walking"), waiting: minutes("waiting"),
    outdoorWaiting: minutes("outdoorWaiting"), riding: minutes("riding"),
  };
}

function TravelResults({ comparison }: { comparison: TravelComparison }) {
  const current = tripTimes(comparison.current);
  const alternative = tripTimes(comparison.alternative);
  const timeDifference = current.total === null || alternative.total === null ? null : alternative.total - current.total;
  const savings = metroSavings(comparison);
  return (
    <div className="trip-results">
      <div className="trip-duration">
        <table>
          <caption>Time door to door</caption>
          <thead><tr><th scope="col">Minutes</th><th scope="col">Current</th><th scope="col">Alternative</th></tr></thead>
          <tbody>
            <tr><th scope="row">Whole trip</th><td>{current.total ?? "—"}</td><td>{alternative.total ?? "—"}</td></tr>
            <tr><th scope="row">Walk + outdoor wait</th><td>{current.outdoors ?? "—"}</td><td>{alternative.outdoors ?? "—"}</td></tr>
          </tbody>
        </table>
        {timeDifference !== null && <p className="trip-difference">{timeDifference === 0 ? "Both routes take the same time." : `The alternative takes ${Math.abs(timeDifference)} min ${timeDifference < 0 ? "less" : "longer"}.`}</p>}
        <p className="comparison-note">Traffic and vehicle enclosure also affect the air you encounter. Use the outdoor minutes to compare time.</p>
      </div>
      <div className="trip-emissions">
        <h3>Estimated CO₂ avoided versus an average motorized road trip</h3>
        {savings ? (
          <>
            <p className="comparison-result">{savings.map(({ kg }) => kg.toFixed(2)).join("–")} <span>kg</span></p>
            <p className="eyebrow">Two calculation methods</p>
            <ul className="trip-methods">
              {savings.map(({ label, gramsPerKm }) => <li key={label}>{label} <span>{gramsPerKm} g/km</span></li>)}
            </ul>
            <p className="comparison-note">Per passenger, one way, for {comparison.metroKm} km by Delhi Metro. Historical factors from TERI exclude feeder trips.</p>
            <div className="source-links">
              <a href={metroSources.teri}>TERI methodology <ArrowUpRight size={13} aria-hidden /></a>
              <a href={metroSources.dmrc}>DMRC CarbonLite <ArrowUpRight size={13} aria-hidden /></a>
            </div>
          </>
        ) : <p className="comparison-note">Choose motorized road and Delhi Metro, select the average road baseline and enter the one-way rail distance to calculate savings.</p>}
      </div>
    </div>
  );
}

export function TripComparison({ saved, ready, onSave }: {
  saved: TravelComparison | null; ready: boolean; onSave: (travel: TravelComparison) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const saving = useRef(false);
  const editVersion = useRef(0);

  async function saveRoutes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const metroKm = fields.get("metroKm");
    const submittedVersion = editVersion.current;
    saving.current = true;
    try {
      const { travelComparisonSchema } = await import("@/lib/travel-schema");
      if (!form.isConnected || submittedVersion !== editVersion.current) return;
      const response = travelComparisonSchema.safeParse({
        current: readRoute(fields, "current"), alternative: readRoute(fields, "alternative"),
        averageRoadBaseline: fields.has("averageRoadBaseline"), metroKm: metroKm ? Number(metroKm) : null,
      });
      if (!response.success) {
        const issue = response.error.issues[0];
        const route = issue.path[0];
        const prefix = route === "current" || route === "alternative" ? `${routeLabels[route]}. ` : "";
        setError(prefix + issue.message);
        const input = form.elements.namedItem(issue.path.join("."));
        if (input instanceof HTMLElement) input.focus();
        return;
      }
      onSave(response.data);
      setDirty(false);
      setError("");
      setNotice("Route comparison updated.");
    } catch {
      if (form.isConnected) setError("The comparison could not be saved. Try again.");
    } finally {
      saving.current = false;
    }
  }

  return (
    <section className="planner-chapter" aria-labelledby="routes-title">
      <h2 id="routes-title" className="eyebrow"><Route size={17} aria-hidden /> Compare two routes</h2>
      <p className="chapter-heading">The whole trip.</p>
      <p className="chapter-intro" id="route-instructions">Include both ends of the journey. Enter 0 for legs you skip and leave unknown times blank. Count outside waiting as part of all waiting.</p>
      <form key={String(ready)} className="trip-form" onSubmit={saveRoutes} onChange={() => {
        editVersion.current += 1;
        setDirty(true);
        setError("");
        setNotice("");
      }} aria-describedby={error ? "route-instructions route-error" : "route-instructions"}>
        <fieldset disabled={!ready}>
          <div className="trip-pair">
            <RouteFields name="current" trip={saved?.current} />
            <RouteFields name="alternative" trip={saved?.alternative} />
          </div>
          <div className="trip-baseline">
            <label className="check-label"><input name="averageRoadBaseline" type="checkbox" defaultChecked={saved?.averageRoadBaseline ?? false} /> Use an average motorized road trip as the CO₂ baseline</label>
            <label>One-way Metro distance (km)<input type="number" name="metroKm" min={0} step="any" inputMode="decimal" defaultValue={saved?.metroKm ?? ""} /></label>
          </div>
          {error && <p id="route-error" role="alert" className="form-error">{error}</p>}
          <button className="button button-primary" type="submit">Save and compare <ArrowUpRight size={16} aria-hidden /></button>
        </fieldset>
      </form>
      <p role="status" className="form-notice chapter-notice">{notice}</p>
      {saved && !dirty && <TravelResults comparison={saved} />}
    </section>
  );
}
