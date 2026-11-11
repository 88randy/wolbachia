/** Zone used only before the profile names an organization (the backend's organization default). */
export const DEFAULT_TIME_ZONE = "America/Merida";

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => values.find((item) => item.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    clock: `${part("hour")}:${part("minute")}`,
  };
}

/**
 * `HH:mm` of an ISO instant in the organization's zone, so the phone shows the same hour as the
 * web even if its own zone is wrong. Returns the input when it is not a date.
 */
export function formatClock(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return parts(date, timeZone).clock;
}

interface InboxTimeOptions {
  readonly timeZone: string;
  readonly now?: Date;
  readonly locale?: string;
}

/** The clock today; localized date and clock on other days (the year disambiguates old evidence). */
export function formatInboxTime(
  iso: string,
  { timeZone, now = new Date(), locale = "es-MX" }: InboxTimeOptions,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const moment = parts(date, timeZone);
  if (moment.day === parts(now, timeZone).day) return moment.clock;
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${day} ? ${moment.clock}`;
}
