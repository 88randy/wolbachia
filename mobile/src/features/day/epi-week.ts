const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/** First weekday of the organization's epi week: `mmwr` Sunday (0), `iso` or missing Monday (1). */
export function weekStartDay(epiWeek: string | null): number {
  return epiWeek === "mmwr" ? 0 : 1;
}

const atMidnight = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Last local date (YYYY-MM-DD) of the epi week that contains `date`. */
export function epiWeekEnd(date: string, epiWeek: string | null): string {
  const day = new Date(atMidnight(date)).getUTCDay();
  const offset = (day - weekStartDay(epiWeek) + WEEK_DAYS) % WEEK_DAYS;
  return isoDate(atMidnight(date) + (WEEK_DAYS - 1 - offset) * DAY_MS);
}

/**
 * #374: a capture on local date `captured` completes the task due `due` when
 * `due <= captured <= end of due's epi week` (same rule as the backend completion projection).
 */
export function isWithinTaskWeek(
  due: string,
  captured: string | null,
  epiWeek: string | null,
): boolean {
  return captured !== null && due <= captured && captured <= epiWeekEnd(due, epiWeek);
}
