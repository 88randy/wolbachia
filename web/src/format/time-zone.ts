/**
 * Calendar math in the organization's time zone. The browser zone is never assumed: a supervisor
 * may sit in another city, and the API speaks UTC instants plus organization calendar dates.
 */

/** Zone used only while `/me/` has no organization (the organization default of the backend). */
export const DEFAULT_TIME_ZONE = "America/Merida";

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE_MS = 60_000;

/** The wall clock of `timeZone` at instant `ms`, encoded as if it were a UTC instant. */
function wallClock(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(ms));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today in the organization's zone as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The calendar day (`YYYY-MM-DD`) of a UTC instant in the organization's zone. */
export function calendarDayOf(iso: string, timeZone: string): string | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : todayIn(timeZone, new Date(ms));
}

/** `YYYY-MM-DDTHH:mm` typed in the organization's zone to the UTC instant (ISO, with `Z`). */
export function zonedLocalToIso(local: string, timeZone: string): string | null {
  const match = LOCAL.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  const first = wanted - (wallClock(wanted, timeZone) - wanted);
  const instant = wanted - (wallClock(first, timeZone) - first);
  return new Date(instant).toISOString();
}

/** A UTC instant as `YYYY-MM-DDTHH:mm` in the organization's zone, for a prefilled field. */
export function isoToZonedLocal(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(wallClock(ms, timeZone)).toISOString().slice(0, 16);
}

/**
 * Local midnight of a calendar day in the organization's zone, with its offset
 * (`2026-11-10T00:00:00-06:00`), for API filters that take an instant.
 */
export function zonedDayStart(day: string, timeZone: string): string | null {
  if (!DAY.test(day)) return null;
  const instant = zonedLocalToIso(`${day}T00:00`, timeZone);
  if (instant === null) return null;
  const ms = Date.parse(instant);
  const minutes = Math.round((wallClock(ms, timeZone) - ms) / MINUTE_MS);
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${day}T00:00:00${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}
