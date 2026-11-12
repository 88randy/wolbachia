import { useQuery } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";

/** The four numbers of the home, by the indicator code the admin switches on. */
export const SUMMARY_CODES = [
  "releases_total",
  "quadrants_covered",
  "readings_total",
  "egg_positivity",
] as const;
export type SummaryCode = (typeof SUMMARY_CODES)[number];

export interface PortalHomeData {
  organization: { name: string; slug: string; logoUrl: string | null };
  enabled: readonly string[];
  cutoff: string | null;
  values: Readonly<Record<string, number | null>>;
}

export interface WeekRow {
  weekStart: string;
  releases: number;
  quantity: number;
}

export interface PortalTrendsData {
  cutoff: string | null;
  weeks: readonly WeekRow[];
}

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Zone {
  code: string;
  releases: number;
  geometry: Polygon;
}

export interface PortalMapData {
  cutoff: string | null;
  zones: readonly Zone[];
}

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json =>
  typeof value === "object" && value !== null ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: unknown): number => (typeof value === "number" ? value : 0);

export function readHome(raw: unknown): PortalHomeData {
  const body = asRecord(raw);
  const organization = asRecord(body["organization"]);
  const indicators = asRecord(body["indicators"]);
  const values = asRecord(indicators["values"]);
  return {
    organization: {
      name: asText(organization["name"]) ?? "",
      slug: asText(organization["slug"]) ?? "",
      logoUrl: asText(organization["logo_url"]),
    },
    enabled: asArray(body["enabled_indicators"]).filter(
      (item): item is string => typeof item === "string",
    ),
    cutoff: asText(indicators["cutoff"]),
    values: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, typeof value === "number" ? value : null]),
    ),
  };
}

/** The API groups by week and zone; the public chart adds the zones of each week. */
export function readTrends(raw: unknown): PortalTrendsData {
  const body = asRecord(raw);
  const byWeek = new Map<string, WeekRow>();
  for (const item of asArray(body["rows"])) {
    const row = asRecord(item);
    const weekStart = asText(row["week_start"]);
    if (weekStart === null) continue;
    const current = byWeek.get(weekStart) ?? { weekStart, releases: 0, quantity: 0 };
    byWeek.set(weekStart, {
      weekStart,
      releases: current.releases + asNumber(row["releases"]),
      quantity: current.quantity + asNumber(row["quantity"]),
    });
  }
  return {
    cutoff: asText(body["cutoff"]),
    weeks: [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  };
}

export function readMap(raw: unknown): PortalMapData {
  const body = asRecord(raw);
  const zones = asArray(body["areas"]).flatMap((item) => {
    const area = asRecord(item);
    const geometry = asRecord(area["geometry"]);
    const code = asText(area["area_code"]);
    if (code === null || geometry["type"] !== "Polygon") return [];
    return [
      { code, releases: asNumber(area["releases"]), geometry: geometry as unknown as Polygon },
    ];
  });
  return { cutoff: asText(body["cutoff"]), zones };
}

/** The portal answers 404 when it is off or the address is wrong: that is its own state. */
export function isPortalMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

const ONE_MINUTE_MS = 60_000;

/**
 * Each portal query is keyed by its public API path first: that is what keeps it (and only it)
 * across sign in and sign out (`session/public-api.ts`).
 */
const PORTAL_HOME = "/api/v1/portal/{org_slug}/";
const PORTAL_TRENDS = "/api/v1/portal/{org_slug}/releases-by-week/";
const PORTAL_MAP = "/api/v1/portal/{org_slug}/coverage/";

export function usePortalHome(slug: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: [PORTAL_HOME, slug],
    staleTime: ONE_MINUTE_MS,
    retry: false,
    queryFn: async ({ signal }) =>
      readHome(
        unwrap(
          await client.GET(PORTAL_HOME, {
            params: { path: { org_slug: slug } },
            signal,
          }),
        ),
      ),
  });
}

export function usePortalTrends(slug: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: [PORTAL_TRENDS, slug],
    staleTime: ONE_MINUTE_MS,
    retry: false,
    queryFn: async ({ signal }) =>
      readTrends(
        unwrap(
          await client.GET(PORTAL_TRENDS, {
            params: { path: { org_slug: slug } },
            signal,
          }),
        ),
      ),
  });
}

export function usePortalMap(slug: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: [PORTAL_MAP, slug],
    staleTime: ONE_MINUTE_MS,
    retry: false,
    queryFn: async ({ signal }) =>
      readMap(
        unwrap(
          await client.GET(PORTAL_MAP, {
            params: { path: { org_slug: slug } },
            signal,
          }),
        ),
      ),
  });
}
