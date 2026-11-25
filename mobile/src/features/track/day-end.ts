const DAY_MS = 86_400_000;

/** The instant's wall-clock reading in `timeZone`, as UTC milliseconds (seconds precision). */
function wallClock(at: number, timeZone: string | undefined): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  // Some engines print midnight as "24" with hour12: false.
  return Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % 24,
    part("minute"),
    part("second"),
  );
}

function validZone(timeZone: string | null): string | undefined {
  if (timeZone === null) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined; // the device zone beats losing the track to a RangeError
  }
}

/**
 * The first local end of the work day after `openedAt`, in the organization's time zone (the
 * device zone when it is unknown). A shift opened after the day end runs until the next one.
 */
export function dayEndAfter(openedAt: number, dayEndMinutes: number, timeZone: string | null) {
  const zone = validZone(timeZone);
  const offsetAt = (at: number) => wallClock(at, zone) - Math.floor(at / 1000) * 1000;
  const wallOpen = openedAt + offsetAt(openedAt);
  let wallEnd = Math.floor(wallOpen / DAY_MS) * DAY_MS + dayEndMinutes * 60_000;
  if (wallEnd <= wallOpen) wallEnd += DAY_MS;
  // Second pass with the offset at the end itself, so a DST change during the day is honored.
  return wallEnd - offsetAt(wallEnd - offsetAt(openedAt));
}
