import { zonedDayStart } from "../format/time-zone";
import type { TextFilter } from "./table-types";

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDay(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * URL value of a picked day. `date` filters send the day; `datetime` filters send midnight in the
 * organization's zone with its offset. The `end` of a `datetime` range is exclusive
 * (`*_before`): the next midnight. The picker's `Date` only carries the calendar day.
 */
export function filterValueOfDate(
  day: Date,
  filter: TextFilter,
  edge: "start" | "end",
  timeZone: string,
): string {
  if (filter.dateFormat !== "datetime") return isoDay(day);
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const calendarDay = isoDay(edge === "end" ? next : day);
  return zonedDayStart(calendarDay, timeZone) ?? calendarDay;
}

/** The day a URL value points to; for an exclusive end, the day before it. */
export function dateOfFilter(value: string | undefined, isExclusiveEnd = false): Date | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isExclusiveEnd && value.includes("T") ? new Date(day.getTime() - DAY_MS) : day;
}

/** Short label of a picked day for the chips, in the user's language. */
export function dayLabel(value: string, language: string, isExclusiveEnd = false): string {
  const day = dateOfFilter(value, isExclusiveEnd);
  return day
    ? day.toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric" })
    : value;
}
