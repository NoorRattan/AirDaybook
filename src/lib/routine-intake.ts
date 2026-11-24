import type { Plan } from "./plan";
import type { RoutineBlock } from "./routine";
import { containsContactDetails, safeLabel } from "./input-text";

export type DraftActivity = Omit<RoutineBlock, "id">;
export const maxDraftActivities = 4;
export const maxRoutineBlocks = 12;

const markers = {
  outdoors: "outdoors", outdoor: "outdoors", outside: "outdoors", bahar: "outdoors", बाहर: "outdoors",
  indoors: "indoors", indoor: "indoors", inside: "indoors", andar: "indoors", अंदर: "indoors",
  fixed: "fixed", तय: "fixed", flexible: "flexible", लचीला: "flexible",
  strenuous: "strenuous", तेज़: "strenuous", easy: "easy", हल्का: "easy",
} as const;

function normalize(line: string) {
  return line.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/\.$/u, "");
}

function parseLine(line: string): DraftActivity | null {
  const match = /^(.+?)\s+(?:(?:at|समय)\s+)?([0-9०-९]{1,2}):([0-9०-९]{2})(?:\s*(am|pm))?(?:\s*बजे)?\s*[,–—-]?\s*(?:(?:for|के लिए)\s+)?([0-9०-९]{1,3})\s*(?:minutes?|mins?|मिनट)\s+(.+)$/iu.exec(line);
  if (!match) return null;
  const [, name, rawHour, rawMinute, period, duration, tail] = match;
  const digits = (value: string) => value.replace(/[०-९]/gu, (digit) => String(digit.codePointAt(0)! - 0x966));
  let hour = Number(digits(rawHour));
  const minute = digits(rawMinute);
  const minutes = Number(digits(duration));
  if (Number(minute) > 59 || minutes < 1 || minutes > 720 || name.length > 100 || !safeLabel(name) || containsContactDetails(name)) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (period.toLowerCase() === "pm" ? 12 : 0);
  } else if (hour > 23) return null;
  const flags = tail.toLowerCase().split(/[\s,]+/u).filter(Boolean);
  if (flags.some((flag) => !Object.hasOwn(markers, flag))) return null;
  const settings = new Set(flags.map((flag) => markers[flag as keyof typeof markers]));
  if (settings.has("outdoors") === settings.has("indoors") ||
    (settings.has("fixed") && settings.has("flexible")) || (settings.has("easy") && settings.has("strenuous"))) return null;
  return {
    name, time: String(hour).padStart(2, "0") + ":" + minute, minutes,
    fixed: settings.has("fixed"), outdoors: settings.has("outdoors"), strenuous: settings.has("strenuous"),
  };
}

export function draftActivities(text: string): DraftActivity[] {
  const lines = new Set(text.split(/[;\n]+/u).map(normalize));
  const activities: DraftActivity[] = [];
  for (const line of lines) {
    const activity = parseLine(line);
    if (activity) activities.push(activity);
    if (activities.length === maxDraftActivities) break;
  }
  return activities;
}

function clockMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function availableDraftActivities(activities: DraftActivity[], existing: DraftActivity[], commitment: Plan | null) {
  const accepted: DraftActivity[] = [];
  const fixedTime = commitment ? clockMinutes(commitment.time) : null;
  for (const activity of activities) {
    if (existing.length + accepted.length >= maxRoutineBlocks) break;
    const start = clockMinutes(activity.time);
    const end = start + activity.minutes;
    if (end > 1440 || (fixedTime !== null && start <= fixedTime && fixedTime < end)) continue;
    const occupied = [...existing, ...accepted].some((saved) => {
      const other = clockMinutes(saved.time);
      return start < other + saved.minutes && other < end;
    });
    if (!occupied) accepted.push(activity);
  }
  return accepted;
}
