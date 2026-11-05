const TWO_DIGITS = 2;

/** `HH:mm` of an ISO instant in the phone's local time. Returns the input when it is not a date. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hours = String(date.getHours()).padStart(TWO_DIGITS, "0");
  const minutes = String(date.getMinutes()).padStart(TWO_DIGITS, "0");
  return `${hours}:${minutes}`;
}

interface InboxTimeOptions {
  readonly now?: Date;
  readonly locale?: string;
}

/** The clock today; localized date and clock on other days (the year disambiguates old evidence). */
export function formatInboxTime(
  iso: string,
  { now = new Date(), locale = "es-MX" }: InboxTimeOptions = {},
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const clock = formatClock(iso);
  if (date.toDateString() === now.toDateString()) return clock;
  const day = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${day} ? ${clock}`;
}
