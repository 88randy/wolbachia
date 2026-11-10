/** Calendar-date helpers on `YYYY-MM-DD` strings (a day of the organization's calendar, no time zone). */
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

function toDate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Today in the organization's time zone, as a calendar date. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** First day of the epi week of `iso`: ISO weeks start on Monday, MMWR weeks on Sunday. */
export function weekStartOf(iso: string, convention: string): string {
  const weekday = (toDate(iso).getUTCDay() + 6) % WEEK_DAYS; // Monday = 0
  const offset = convention === "iso" ? weekday : (weekday + 1) % WEEK_DAYS;
  return addDays(iso, -offset);
}

export function daysOfWeek(start: string): string[] {
  return Array.from({ length: WEEK_DAYS }, (_, index) => addDays(start, index));
}

/** ISO week number of the day, used as the "S45" style label. */
export function weekNumberOf(iso: string): number {
  const date = toDate(iso);
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % WEEK_DAYS)) * DAY_MS);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstWeekStart =
    firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % WEEK_DAYS) * DAY_MS;
  return Math.round((thursday.getTime() - firstWeekStart) / (DAY_MS * WEEK_DAYS)) + 1;
}
