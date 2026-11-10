/** Calendar days travel as `YYYY-MM-DD` in the URL and the API; the picker works with local dates. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

export function fromIsoDay(value: string | undefined): Date | undefined {
  const match = value === undefined ? null : ISO_DAY.exec(value);
  if (match === null) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Start of the given day in the zone of the browser, as an instant for the API. */
export function startOfDayInstant(isoDay: string): string | undefined {
  return fromIsoDay(isoDay)?.toISOString();
}

/** Start of the day AFTER the given one: the `created_before` filter of the API is exclusive. */
export function endOfDayInstant(isoDay: string): string | undefined {
  const day = fromIsoDay(isoDay);
  if (day === undefined) return undefined;
  day.setDate(day.getDate() + 1);
  return day.toISOString();
}

/** A range lives in ONE address key (`2026-11-01_2026-11-10`), so a change is a single update. */
export function encodeRange(from: string | undefined, to: string | undefined): string | undefined {
  return from === undefined ? undefined : `${from}_${to ?? from}`;
}

export function decodeRange(value: string | undefined): { from?: string; to?: string } {
  const [from, to] = (value ?? "").split("_");
  if (fromIsoDay(from) === undefined) return {};
  return { from, ...(fromIsoDay(to) === undefined ? {} : { to }) };
}
