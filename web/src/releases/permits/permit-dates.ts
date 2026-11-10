const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

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
  return new Date(wallClock(ms, timeZone)).toISOString().slice(0, 16);
}
