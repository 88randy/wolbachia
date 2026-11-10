import type { TextFilter } from "./table-types";

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDay(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `+HH:MM` offset of the browser for that day. [ASSUMPTION] browser zone = organization zone. */
function offsetOf(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * URL value of a picked day. `date` filters send the day; `datetime` filters send local midnight
 * with its offset. The `end` of a `datetime` range is exclusive (`*_before`): the next midnight.
 */
export function filterValueOfDate(day: Date, filter: TextFilter, edge: "start" | "end"): string {
  if (filter.dateFormat !== "datetime") return isoDay(day);
  const moment = edge === "end" ? new Date(day.getTime() + DAY_MS) : day;
  return `${isoDay(moment)}T00:00:00${offsetOf(moment)}`;
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
