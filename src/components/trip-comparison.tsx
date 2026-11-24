"use client";

import { useLocale } from "./locale";
import { SourceLink } from "./source-link";

import { ArrowUpRight } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_METRO_KM, metroSavings, metroSources, passengerGrams, tripTimes, type TravelComparison, type Trip } from "@/lib/travel";

const routeLabels = { current: "Current route", alternative: "Alternative route" } as const;
const timings = {
  walking: "Walking", waiting: "All waiting", outdoorWaiting: "Outside waiting", riding: "Riding",
} as const;
const modeLabels = {
  road: "Motorized road", metro: "Delhi Metro", "walk-cycle": "Walk or cycle", other: "Other",
  "two-wheeler": "Two-wheeler", carpool: "Carpool", bus: "City bus", "electric-bus": "Electric bus",
  auto: "Auto or rickshaw", "electric-car": "Electric car", rail: "Other metro or suburban rail", "no-trip": "No trip",
} as const;
const vehicleLabels = { open: "Open", enclosed: "Enclosed", mixed: "Mixed" } as const;
const trafficLabels = { light: "Light", heavy: "Heavy", mixed: "Mixed" } as const;

type FieldProps = (name: string, value: string | number | null | undefined) => {
  name: string; value: string; "aria-invalid"?: boolean; "aria-describedby"?: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

function RouteFields({ name, trip, field }: { name: keyof typeof routeLabels; trip?: Trip; field: FieldProps }) {
  const { t } = useLocale();
  return (
    <fieldset className="trip-leg">
      <legend>{t(routeLabels[name])}</legend>
      <label>{t("Main mode")}
        <select {...field(`${name}.mode`, trip?.mode)}>
          <option value="">{t("Select mode")}</option>
          {Object.entries(modeLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
        </select>
      </label>
      <div className="time-inputs">
        {(Object.keys(timings) as (keyof typeof timings)[]).map((key) => (
          <label key={key}>{t(timings[key])} ({t("min")})
            <input {...field(`${name}.${key}`, trip?.[key])} type="number" min={0} max={1440} step={1} inputMode="numeric" />
          </label>
        ))}
        <label>{t("Vehicle")}
          <select {...field(`${name}.vehicle`, trip?.vehicle)}>
            <option value="">{t("Unspecified")}</option>
            {Object.entries(vehicleLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
          </select>
        </label>
        <label>{t("Traffic")}
          <select {...field(`${name}.traffic`, trip?.traffic)}>
            <option value="">{t("Unspecified")}</option>
            {Object.entries(trafficLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
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
  const { t } = useLocale();
  const current = tripTimes(comparison.current);
  const alternative = tripTimes(comparison.alternative);
  const [trips, setTrips] = useState("");
  const count = Number(trips);
  const tripCount = Number.isInteger(count) && count >= 1 && count <= 124 ? count : null;
  const timeDifference = current.total === null || alternative.total === null ? null : alternative.total - current.total;
  const outdoorDifference = current.outdoors === null || alternative.outdoors === null ? null : alternative.outdoors - current.outdoors;
  const savings = metroSavings(comparison);
  return (
    <div className="trip-results">
      <div className="trip-duration">
        <table>
          <caption>{t("Time door to door")}</caption>
          <thead><tr><th scope="col">{t("Minutes")}</th><th scope="col">{t("Current")}</th><th scope="col">{t("Alternative")}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t("Whole trip")}</th><td>{current.total ?? "—"}</td><td>{alternative.total ?? "—"}</td></tr>
            <tr><th scope="row">{t("Walk + outdoor wait")}</th><td>{current.outdoors ?? "—"}</td><td>{alternative.outdoors ?? "—"}</td></tr>
          </tbody>
        </table>
        {timeDifference !== null && <p className="trip-difference">{timeDifference === 0 ? "Both routes take the same time." : `The alternative takes ${Math.abs(timeDifference)} min ${timeDifference < 0 ? "less" : "longer"}.`}</p>}
        {outdoorDifference !== null && <p className="trip-difference">{outdoorDifference === 0 ? "Walking and outdoor waiting time stays the same." : `The alternative means ${Math.abs(outdoorDifference)} min ${outdoorDifference < 0 ? "less" : "more"} walking and waiting outdoors.`}</p>}
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
              <SourceLink href={metroSources.teri}>{t("TERI project summary")} <ArrowUpRight size={13} aria-hidden /></SourceLink>
              <SourceLink href={metroSources.dmrc}>DMRC CarbonLite <ArrowUpRight size={13} aria-hidden /></SourceLink>
            </div>
          </>
        ) : <p className="comparison-note">Choose motorized road and Delhi Metro, select the average road baseline and enter the one-way rail distance to calculate savings.</p>}
        <TripProjection savings={savings} trips={trips} setTrips={setTrips} count={tripCount} />
        <TailpipeComparison tripCount={tripCount} />
      </div>
    </div>
  );
}

function TripProjection({ savings, trips, setTrips, count }: {
  savings: ReturnType<typeof metroSavings>; trips: string; setTrips: (value: string) => void; count: number | null;
}) {
  const { t } = useLocale();
  const [price, setPrice] = useState("");
  const [alternativePrice, setAlternativePrice] = useState("");
  const unitCost = Number(price) - Number(alternativePrice);
  const hasCost = price !== "" && alternativePrice !== "" && [price, alternativePrice].every((value) => Number(value) >= 0 && Number(value) <= 100000);
  return (
    <fieldset className="trip-projection">
      <legend>{t("Project repeat trips and cost")}</legend>
      <label>One-way trips per month<input type="number" min={1} max={124} value={trips} onChange={(event) => setTrips(event.target.value)} /></label>
      <label>Current cost per trip (₹)<input type="number" min={0} max={100000} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label>Alternative cost per trip (₹)<input type="number" min={0} max={100000} step="0.01" value={alternativePrice} onChange={(event) => setAlternativePrice(event.target.value)} /></label>
      {savings && count && <p>{savings.map(({ kg }) => (kg * count).toFixed(2)).join("–")} kg CO₂ avoided per month for the trips entered.</p>}
      {hasCost && <p>{unitCost < 0 ? "Extra cost" : "Estimated savings"} ₹{Math.abs(unitCost).toFixed(2)} per trip{count && ` and ₹${Math.abs(unitCost * count).toFixed(2)} per month`}.</p>}
    </fieldset>
  );
}

const pollutantFields = { co2: "CO₂", pm25: "PM₂.₅", nox: "NOₓ" } as const;
const emptyFactors = { km: "", riders: "", co2: "", pm25: "", nox: "" };
function TailpipeComparison({ tripCount }: { tripCount: number | null }) {
  const [legs, setLegs] = useState({ current: emptyFactors, alternative: emptyFactors });
  const factors = Object.keys(pollutantFields) as (keyof typeof pollutantFields)[];
  return (
    <details className="tailpipe-workbench">
      <summary>Compare published tailpipe factors</summary>
      <p className="comparison-note">Use factors from a source that matches each vehicle. The calculation uses grams per vehicle-kilometre, shared equally across riders. It covers tailpipe emissions.</p>
      <div className="trip-pair">
        {(["current", "alternative"] as const).map((leg) => (
          <fieldset key={leg} className="trip-projection">
            <legend>{routeLabels[leg]}</legend>
            {([["km", "Distance (km)", 0, 1000], ["riders", "Riders", 1, 200],
              ...factors.map((factor) => [factor, pollutantFields[factor] + " (g/km)", 0, 10000] as const)] as const).map(([field, label, min, max]) => (
              <label key={field}>{label}<input type="number" min={min} max={max} step={field === "riders" ? 1 : "any"}
                value={legs[leg][field]} onChange={(event) => {
                  const { value } = event.target;
                  setLegs((current) => ({ ...current, [leg]: { ...current[leg], [field]: value } }));
                }} /></label>
            ))}
          </fieldset>
        ))}
      </div>
      {factors.map((factor) => {
        const before = passengerGrams(legs.current[factor], legs.current.km, legs.current.riders);
        const after = passengerGrams(legs.alternative[factor], legs.alternative.km, legs.alternative.riders);
        if (before === null || after === null) return null;
        const delta = before - after;
        const grams = (value: number) => new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 4 }).format(Math.abs(value));
        return <p key={factor}>{pollutantFields[factor]} {grams(before)} → {grams(after)} g per rider per trip.
          {delta !== 0 && tripCount && ` ${grams(delta * tripCount)} g ${delta > 0 ? "less" : "more"} per rider per month.`}</p>;
      })}
    </details>
  );
}

export function TripComparison({ saved, ready, onSave }: {
  saved: TravelComparison | null; ready: boolean; onSave: (travel: TravelComparison) => void;
}) {
  const { t } = useLocale();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [baselineEdit, setBaselineEdit] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const saving = useRef(false);
  const editVersion = useRef(0);
  const dirty = Boolean(Object.keys(edits).length || baselineEdit !== null);

  function markEdited() {
    editVersion.current++;
    setError(null);
    setNotice("");
  }

  const field: FieldProps = (name, initial) => {
    const savedValue = String(initial ?? "");
    return {
      name, value: edits[name] ?? savedValue,
      "aria-invalid": error?.field === name || undefined,
      "aria-describedby": error?.field === name ? "route-error" : undefined,
      onChange: (event) => {
        const { value } = event.target;
        markEdited();
        setEdits((previous) => {
          const next = { ...previous };
          if (value === savedValue) delete next[name];
          else next[name] = value;
          return next;
        });
      },
    };
  };

  async function saveRoutes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving.current) return;
    const form = event.currentTarget;
    const submittedVersion = editVersion.current;
    saving.current = true;
    try {
      const { travelComparisonSchema } = await import("@/lib/travel-schema");
      if (!form.isConnected || submittedVersion !== editVersion.current) return;
      const fields = new FormData(form);
      const metroKm = fields.get("metroKm");
      if (metroKm && Number(metroKm) > MAX_METRO_KM) {
        setError({ field: "metroKm", message: `Enter a Metro distance of up to ${MAX_METRO_KM} km.` });
        return;
      }
      const response = travelComparisonSchema.safeParse({
        current: readRoute(fields, "current"), alternative: readRoute(fields, "alternative"),
        averageRoadBaseline: fields.has("averageRoadBaseline"), metroKm: metroKm ? Number(metroKm) : null,
      });
      if (!response.success) {
        const issue = response.error.issues[0];
        const route = issue.path[0];
        const prefix = route === "current" || route === "alternative" ? `${routeLabels[route]}. ` : "";
        const field = issue.path.join(".");
        setError({ message: prefix + issue.message, field });
        const input = form.elements.namedItem(field);
        if (input instanceof HTMLElement) input.focus();
        return;
      }
      onSave(response.data);
      setEdits({});
      setBaselineEdit(null);
      setError(null);
      setNotice("Route comparison updated.");
    } catch {
      if (form.isConnected && submittedVersion === editVersion.current) setError({ message: "The comparison could not be saved. Try again." });
    } finally {
      saving.current = false;
    }
  }

  return (
    <section className="planner-chapter" aria-labelledby="routes-title">
      <h2 id="routes-title" className="sr-only">Route details</h2>
      <p className="chapter-intro" id="route-instructions">Include both ends of the journey. Enter 0 for legs you skip and leave unknown times blank. Count outside waiting as part of all waiting.</p>
      <form className="trip-form" onSubmit={saveRoutes} aria-describedby="route-instructions">
        <fieldset disabled={!ready}>
          <div className="trip-pair">
            <RouteFields name="current" trip={saved?.current} field={field} />
            <RouteFields name="alternative" trip={saved?.alternative} field={field} />
          </div>
          <div className="trip-baseline">
            <label className="check-label"><input name="averageRoadBaseline" type="checkbox" checked={baselineEdit ?? saved?.averageRoadBaseline ?? false} onChange={(event) => {
              const { checked } = event.target;
              markEdited();
              setBaselineEdit(checked === (saved?.averageRoadBaseline ?? false) ? null : checked);
            }} /> Use an average motorized road trip as the CO₂ baseline</label>
            <label>One-way Metro distance (km)<input {...field("metroKm", saved?.metroKm)} type="number" min={0} max={MAX_METRO_KM} step="any" inputMode="decimal" /></label>
          </div>
          <p id="route-error" role="alert" className={error ? "form-error" : "sr-only"}>{error?.message}</p>
          <button className="button button-primary" type="submit">{t("Save and compare")} <ArrowUpRight size={16} aria-hidden /></button>
        </fieldset>
      </form>
      <p role="status" className="form-notice chapter-notice">{notice}</p>
      {saved && dirty && <p role="status" className="form-notice chapter-notice">You’re viewing saved results. Save and compare to include your edits.</p>}
      {saved && <TravelResults comparison={saved} />}
    </section>
  );
}
