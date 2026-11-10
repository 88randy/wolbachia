export const PERIODS = ["4w", "8w", "12w", "26w"] as const;
export type Period = (typeof PERIODS)[number];
export const GRANULARITIES = ["week", "day"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** What the URL says about a dashboard: shareable and bookmarkable. */
export interface DashboardFilters {
  period: Period;
  granularity: Granularity;
  center: string;
  quadrant: string;
}

export type DashboardSearch = Readonly<Record<string, string | undefined>>;

const WEEK_DAYS = 7;
const DAY_MS = 86_400_000;

function isPeriod(value: string | undefined): value is Period {
  return PERIODS.some((period) => period === value);
}

function isGranularity(value: string | undefined): value is Granularity {
  return GRANULARITIES.some((granularity) => granularity === value);
}

export function readDashboardFilters(
  search: DashboardSearch,
  defaultPeriod: Period,
): DashboardFilters {
  const period = search["period"];
  const granularity = search["granularity"];
  return {
    period: isPeriod(period) ? period : defaultPeriod,
    granularity: isGranularity(granularity) ? granularity : "week",
    center: search["center"] ?? "",
    quadrant: search["quadrant"] ?? "",
  };
}

/** Writes only what differs from the defaults, so the default view has a clean address. */
export function toDashboardSearch(
  filters: DashboardFilters,
  defaultPeriod: Period,
): Record<string, string> {
  return {
    ...(filters.period === defaultPeriod ? {} : { period: filters.period }),
    ...(filters.granularity === "week" ? {} : { granularity: filters.granularity }),
    ...(filters.center === "" ? {} : { center: filters.center }),
    ...(filters.quadrant === "" ? {} : { quadrant: filters.quadrant }),
  };
}

/** Today in the organization's time zone as `YYYY-MM-DD`. */
export function localToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The inclusive date range the period covers, ending today. */
export function periodRange(period: Period, today: string): { dateFrom: string; dateTo: string } {
  const days = Number.parseInt(period, 10) * WEEK_DAYS;
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: today };
}
