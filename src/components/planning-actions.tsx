import { CalendarClock, House, Map } from "lucide-react";
import type { Preferences } from "@/lib/preferences";
import { SOURCES } from "@/lib/readings";

export function PlanningActions({ preferences }: { preferences: Preferences }) {
  const { canMoveActivityIndoors, canCombineErrands, metroAvailable } = preferences;
  const trip = metroAvailable ? {
    title: "Compare Metro with your road trip",
    description: "Compare total travel and outdoor waiting. Add the one-way Metro distance for a CO₂ estimate.",
  } : canCombineErrands === false ? {
    title: "Compare two routes you can use",
    description: "Count the full journey, including walking and waiting at both ends.",
  } : {
    title: canCombineErrands ? "Combine two nearby errands" : "Check for errands you can combine",
    description: "One outing can replace two separate trips. Compare the route and time before you decide.",
  };
  return (
    <section className="plan-actions" aria-labelledby="plan-actions-title">
      <h2 id="plan-actions-title" className="section-title">What you can change</h2>
      <ul>
        <li>
          <CalendarClock size={19} aria-hidden />
          <div>
            <h3>{canMoveActivityIndoors ? "Move a flexible activity indoors" : "Compare where to wait"}</h3>
            <p>{canMoveActivityIndoors
              ? "Pick an indoor venue for one flexible activity. Keep your fixed commitments in the schedule."
              : "For a pickup or appointment you need to keep, compare how many minutes you’d wait outdoors."} <a href="#schedule">Edit your schedule</a></p>
          </div>
        </li>
        <li>
          <House size={19} aria-hidden />
          <div>
            <h3>Skip indoor incense or candles when you can</h3>
            <p>That removes one source of smoke in the room. <a href={SOURCES.indoor} target="_blank" rel="noreferrer">NCDC handbook</a></p>
          </div>
        </li>
        <li>
          <Map size={19} aria-hidden />
          <div>
            <h3>{trip.title}</h3>
            <p>{trip.description} <a href="#routes">Compare routes</a></p>
          </div>
        </li>
      </ul>
    </section>
  );
}
