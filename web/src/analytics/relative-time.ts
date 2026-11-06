import type { Locale } from "@wolbachia/i18n";
interface RelativeValue {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
}
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
  ["second", SECOND],
];
/** Select the largest whole relative unit; an injected clock makes this deterministic. */
export function relativeTimeValue(dateTime: string, now: number): RelativeValue | null {
  const elapsed = Date.parse(dateTime) - now;
  if (!Number.isFinite(elapsed)) return null;
  const [unit, length] = UNITS.find(([, duration]) => Math.abs(elapsed) >= duration) ?? [
    "second",
    SECOND,
  ];
  const value = Math.round(elapsed / length);
  return { value: Object.is(value, -0) ? 0 : value, unit };
}

/** Format the selected unit in the UI language; keep invalid input visible. */
export function formatRelativeTime(dateTime: string, language: Locale, now: number): string {
  const relative = relativeTimeValue(dateTime, now);
  if (relative === null) return dateTime;
  return new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(
    relative.value,
    relative.unit,
  );
}
