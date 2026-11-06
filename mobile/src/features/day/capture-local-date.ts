/** Captured organization context identifies delivery only; it never orders server completion. */
export function captureLocalDate(deviceTime: string, timeZone: unknown): string | null {
  if (typeof timeZone !== "string" || timeZone.length === 0) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(deviceTime));
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const year = part("year"),
      month = part("month"),
      day = part("day");
    if (year === undefined || month === undefined || day === undefined) return null;
    return `${year}-${month}-${day}`;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
