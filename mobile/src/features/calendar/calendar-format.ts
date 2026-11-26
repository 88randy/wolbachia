/** A YYYY-MM-DD local date read at noon UTC: formatting it in UTC never shifts the day. */
const atNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);

export interface CalendarFormat {
  /** "noviembre de 2026" for "2026-11". */
  readonly monthTitle: (month: string) => string;
  /** "25 de noviembre de 2026" for "2026-11-25". */
  readonly dayDate: (date: string) => string;
  /** Narrow weekday ("L") of a date. */
  readonly weekday: (date: string) => string;
  /** Time of an instant in the organization zone; null when it cannot be read. */
  readonly time: (instant: string | null) => string | null;
}

/** Built once per locale + zone (js-hoist-intl): formatters are expensive on Hermes. */
export function calendarFormat(locale: string, timeZone: string): CalendarFormat {
  const month = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "long" });
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "narrow" });
  const time = new Intl.DateTimeFormat(locale, { timeZone, timeStyle: "short" });
  return {
    monthTitle: (value) => month.format(atNoon(`${value}-01`)),
    dayDate: (value) => day.format(atNoon(value)),
    weekday: (value) => weekday.format(atNoon(value)),
    time: (instant) =>
      instant !== null && Number.isFinite(Date.parse(instant))
        ? time.format(new Date(instant))
        : null,
  };
}

/** "25" for "2026-11-25". */
export const dayNumber = (date: string) => String(Number(date.slice(8)));
