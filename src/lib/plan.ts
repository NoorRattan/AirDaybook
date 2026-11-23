import type { ReadingSelection } from "./readings";

export const MAX_WAIT_MINUTES = 1440;
export const MAX_COMMITMENT_LENGTH = 100;
export const PLAN_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type Plan = {
  commitment: string;
  time: string;
  previousWait: number | null;
  revisedWait: number | null;
};

const replayPlan: Plan = { commitment: "School pickup", time: "15:00", previousWait: null, revisedWait: null };

export function initialPlan(plan: Plan | null, selection: ReadingSelection): Plan | null {
  return plan ?? (selection === "replay" ? replayPlan : null);
}

export function displayPlanTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return { clock: `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`, meridiem: hour < 12 ? "am" : "pm" };
}

export function parseWait(value: string) {
  if (value.trim() === "") return { kind: "empty", minutes: null } as const;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_WAIT_MINUTES
    ? { kind: "valid", minutes } as const
    : { kind: "invalid", minutes: null } as const;
}

export function parsePlan(fields: Record<keyof Plan, string>): { plan: Plan } | { error: string; field: keyof Plan } {
  const commitment = fields.commitment.trim();
  if (!commitment || commitment.length > MAX_COMMITMENT_LENGTH) {
    return { field: "commitment", error: `Enter a commitment of 1–${MAX_COMMITMENT_LENGTH} characters.` };
  }
  if (!PLAN_TIME.test(fields.time)) return { field: "time", error: "Enter a fixed time." };
  const previous = parseWait(fields.previousWait);
  const revised = parseWait(fields.revisedWait);
  if (previous.kind === "invalid" || revised.kind === "invalid") {
    return {
      field: previous.kind === "invalid" ? "previousWait" : "revisedWait",
      error: `Enter a whole number from 0 to ${MAX_WAIT_MINUTES} minutes.`,
    };
  }
  return { plan: { commitment, time: fields.time, previousWait: previous.minutes, revisedWait: revised.minutes } };
}

export function compareWaiting(before: number | null, after: number | null) {
  const scale = Math.max(before ?? 0, after ?? 0, 1);
  return {
    delta: before === null || after === null ? null : before - after,
    currentFraction: (before ?? 0) / scale,
    revisedFraction: (after ?? 0) / scale,
  };
}
