/** Epidemiological week numbers, mirroring `core.time.epi_week_label` of the backend. */
export type EpiConvention = "iso" | "mmwr";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const FOUR = 4;

function utcDay(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (match === null) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Monday = 0 (as Python's `weekday()`). */
function weekday(day: Date): number {
  return (day.getUTCDay() + 6) % 7;
}

function epiWeekStart(day: Date, convention: EpiConvention): Date {
  const offset = convention === "iso" ? 0 : 1;
  return new Date(day.getTime() - ((weekday(day) + offset) % 7) * DAY_MS);
}

export interface EpiWeek {
  year: number;
  week: number;
}

/** The week (at least four days in week one) a calendar date falls in; null for a bad date. */
export function epiWeekOf(isoDate: string, convention: EpiConvention): EpiWeek | null {
  const day = utcDay(isoDate);
  if (day === null) return null;
  const firstWeek = (year: number) => epiWeekStart(new Date(Date.UTC(year, 0, FOUR)), convention);
  let year = day.getUTCFullYear();
  if (day < firstWeek(year)) year -= 1;
  else if (day >= firstWeek(year + 1)) year += 1;
  const week =
    Math.floor((epiWeekStart(day, convention).getTime() - firstWeek(year).getTime()) / WEEK_MS) + 1;
  return { year, week };
}
