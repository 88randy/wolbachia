import type { Draft } from "./types.ts";
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
function weekStart(year: number, firstDay: number): number {
  const fourth = Date.UTC(year, 0, 4);
  return fourth - ((new Date(fourth).getUTCDay() - firstDay + WEEK_DAYS) % WEEK_DAYS) * DAY_MS;
}
function localDate(deviceTime: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(deviceTime));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}
/** Match backend/ovitraps/capture.py: local date, ISO Monday/MMWR Sunday, four-day week one. */
export function captureWeek(draft: Pick<Draft, "deviceTime" | "assignment">): string | null {
  const organization = draft.assignment?.organization;
  if (!organization?.timezone || !["iso", "mmwr"].includes(organization.epi_week)) return null;
  try {
    const date = localDate(draft.deviceTime, organization.timezone);
    const firstDay = organization.epi_week === "iso" ? 1 : 0;
    let year = new Date(date).getUTCFullYear();
    if (date < weekStart(year, firstDay)) year--;
    else if (date >= weekStart(year + 1, firstDay)) year++;
    const week = Math.floor((date - weekStart(year, firstDay)) / (DAY_MS * WEEK_DAYS)) + 1;
    return `${String(year)}-W${String(week).padStart(2, "0")}`;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
