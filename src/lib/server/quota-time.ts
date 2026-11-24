export const quotaWindowMs = 60_000;
const dayMs = 86_400_000;
const dateInIndia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});

export function quotaDay(now: number) {
  return dateInIndia.format(now);
}

export function quotaCutoff(now: number) {
  return quotaDay(now - 6 * dayMs);
}

export function secondsUntilQuotaReset(day: string, now: number) {
  return Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00+05:30`) + dayMs - now) / 1000));
}
