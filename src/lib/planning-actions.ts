import { compareWaiting, type Plan } from "./plan";
import type { Preferences } from "./preferences";
import { SOURCES, type readingView } from "./readings";

type SelectedReading = ReturnType<typeof readingView>;
type Source = { label: string; url: string };
type PlanningAction = {
  area: "schedule" | "home" | "travel";
  title: string;
  description: string;
  source?: Source;
};

function readingContext(reading: SelectedReading) {
  if (!reading) return "You can compare options now. Add a local reading for more context.";
  if (reading.kind === "historical") return "Try these choices with the historical Delhi example.";
  if (reading.kind === "stale") return "Use a newer local reading before treating this as today’s plan.";
  if (reading.kind === "display-only") return "Use these general options alongside the reading you entered.";
  return `${reading.place} reports ${reading.title.toLowerCase()} air quality in the reading you entered.`;
}

export function planningActions(preferences: Preferences, reading: SelectedReading, plan: Plan | null) {
  const { hasPurifier, canMoveActivityIndoors, canCombineErrands, metroAvailable } = preferences;
  const delta = compareWaiting(plan?.previousWait ?? null, plan?.revisedWait ?? null).delta;
  const elevated = reading?.kind === "provided" &&
    (reading.band === "Poor" || reading.band === "Very Poor" || reading.band === "Severe");
  const indoorSource: PlanningAction = {
    area: "home",
    title: "Skip indoor incense or mosquito coils when you can",
    description: "That removes one smoke source in the room.",
    source: { label: "NCDC household guidance", url: SOURCES.indoor },
  };
  const indoorOptions: PlanningAction[] = [indoorSource];
  if (hasPurifier === true) {
    indoorOptions.push({
      area: "home",
      title: "Use the purifier in the room you spend time in",
      description: "Check the room size it covers and follow the manufacturer’s instructions. Keep reducing indoor smoke sources.",
      source: { label: "EPA air cleaner guidance", url: SOURCES.filtration },
    });
  }
  const schedule: PlanningAction = {
    area: "schedule",
    title: canMoveActivityIndoors ? "Move a flexible activity indoors" : "Compare where to wait",
    description: canMoveActivityIndoors
      ? "Choose an indoor location for a flexible activity and keep your fixed commitments in the schedule."
      : delta !== null && delta > 0
        ? `Your revised wait saves ${delta} min outside with the same scheduled time.`
        : "For a pickup or appointment you need to keep, compare how many minutes you’d wait outdoors.",
  };
  const travel: PlanningAction = {
    area: "travel",
    ...(metroAvailable ? {
      title: "Compare Metro with your road trip",
      description: "Compare door-to-door travel and outdoor waiting. Enter the one-way rail distance for a CO₂ estimate.",
    } : canCombineErrands === false ? {
      title: "Compare two routes you can use",
      description: "Count the full journey, including walking and waiting at both ends.",
    } : {
      title: canCombineErrands ? "Combine two nearby errands" : "Check for errands you can combine",
      description: "One outing can replace two separate trips. Compare the route and time before you decide.",
    }),
  };

  return {
    context: readingContext(reading),
    actions: elevated && !canMoveActivityIndoors
      ? [...indoorOptions, schedule, travel] : [schedule, ...indoorOptions, travel],
  };
}
