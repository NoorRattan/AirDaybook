"use client";

import { Clock3, MapPin, ArrowUpRight, Radio } from "lucide-react";
import { readingView, SOURCES } from "@/lib/readings";
import { useDraft } from "./draft-provider";

export function ReadingCard() {
  const { draft, ready, now } = useDraft();
  const reading = readingView(draft.selection, now);
  const replay = draft.selection === "replay";
  return (
    <section className="reading-panel" id="active-reading" tabIndex={-1} aria-labelledby="reading-heading">
      <div className="section-line">
        <h2 className="eyebrow" id="reading-heading"><Radio size={16} aria-hidden /> Selected reading</h2>
        {reading && <span className={replay ? "state state-replay" : "state"}>{reading.state}</span>}
      </div>
      {reading ? (
        <div className="reading-content" key={draft.selection === "replay" ? "replay" : draft.selection?.observation.observedAt}>
          <div className="reading-number"><strong>{reading.value}</strong><span>{reading.unit}</span></div>
          <h3 className="reading-title">{reading.title}</h3>
          {reading.kind === "historical" && <p className="reading-context">Example from the archive. Check CPCB for today’s reading.</p>}
          {reading.kind === "stale" && <p className="reading-context">This reading is over six hours old. Check a newer reading before making decisions.</p>}
          {reading.normalization && <p className="muted">{reading.normalization}</p>}
          <ul className="reading-meta">
            <li><MapPin size={15} aria-hidden /> {reading.place} · {reading.scope}</li>
            <li><Clock3 size={15} aria-hidden /> {reading.time}</li>
          </ul>
          <div className="reading-source">
            <span>{reading.origin}</span>
            <span>{reading.averaging}</span>
            {reading.url ? <a href={reading.url} target="_blank" rel="noreferrer">{reading.source}<ArrowUpRight size={14} aria-hidden /></a>
              : <span>{reading.source}</span>}
          </div>
        </div>
      ) : (
        <div className="empty-reading">
          <h3>{ready ? "No current reading" : "Opening your workspace"}</h3>
          <p>{ready ? "Look up your city or station on CPCB and enter the reading here. You can also start planning before you have one." : "Checking for a reading saved on this device."}</p>
        </div>
      )}
    </section>
  );
}

export function ReplayDetails() {
  return (
    <details className="replay-details">
      <summary>View the dated CAQM orders</summary>
      <ol className="order-timeline">
        <li><time dateTime="2026-11-06">06 Nov 2026</time><p>Delhi reported city AQI 382. CAQM invoked GRAP Stage III ahead of forecast Severe conditions.</p></li>
        <li><time dateTime="2026-11-17">17 Nov 2026</time><p>CAQM revoked Stage III when Delhi reported AQI 204. Stage I and II remained in force as of that date.</p></li>
      </ol>
      <p className="archive-note">The Stage III invocation is superseded. A separate order scheduled additional measures for 5–20 November 2026.</p>
      <div className="source-links">
        <a href={SOURCES.invocation} target="_blank" rel="noreferrer">6 November invocation <ArrowUpRight size={14} aria-hidden /></a>
        <a href={SOURCES.revocation} target="_blank" rel="noreferrer">17 November revocation <ArrowUpRight size={14} aria-hidden /></a>
        <a href={SOURCES.additionalMeasures} target="_blank" rel="noreferrer">30 October order <ArrowUpRight size={14} aria-hidden /></a>
        <a href="https://caqm.nic.in/" target="_blank" rel="noreferrer">Current CAQM notices <ArrowUpRight size={14} aria-hidden /></a>
      </div>
    </details>
  );
}
