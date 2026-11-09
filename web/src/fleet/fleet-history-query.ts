import { unwrap } from "@wolbachia/api-client";
import type { Schemas, operations } from "@wolbachia/api-client";
import type { TableState } from "../data-table/table-types";
import { fleetScopedOptions, assertFleetRead } from "./use-fleet-scope";
import type { FleetRecordScope } from "./use-fleet-scope";
import type { HistoryTab } from "./fleet-history-table";
import { FLEET_PAGE_SIZE } from "./fleet-table";
export type HistoryRow =
  | Schemas["ServiceRecord"]
  | Schemas["ResponsibilityLetter"]
  | Schemas["FuelLoad"]
  | Schemas["Incident"];
export interface HistoryPage {
  count: number;
  next?: string | null | undefined;
  previous?: string | null | undefined;
  results: HistoryRow[];
}
function params(state: TableState) {
  return {
    page: state.page,
    page_size: FLEET_PAGE_SIZE,
    ...(state.isSortExplicit && state.sort
      ? { ordering: `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}` }
      : {}),
  };
}
function fuelParams(
  state: TableState,
  motorcycle: string,
): NonNullable<operations["fuel_loads_list"]["parameters"]["query"]> {
  const status = state.filters["efficiency_status"];
  return {
    ...params(state),
    motorcycle,
    ...(status === "ok" || status === "review" || status === "unavailable"
      ? { efficiency_status: status }
      : {}),
    ...(state.filters["courier"] ? { courier: state.filters["courier"] } : {}),
    ...(state.filters["date_from"] ? { date_from: state.filters["date_from"] } : {}),
    ...(state.filters["date_before"] ? { date_before: state.filters["date_before"] } : {}),
  };
}
async function readHistory(
  scope: FleetRecordScope,
  target: { motorcycle: string; tab: HistoryTab; state: TableState },
  signal: AbortSignal,
): Promise<HistoryPage> {
  assertFleetRead(scope, signal);
  const { motorcycle, tab, state } = target;
  const nested = {
    params: {
      path: { motorcycle_id: motorcycle },
      query: { ...params(state), include_voided: state.includeVoided },
    },
    signal,
  };
  if (tab === "services")
    return unwrap(await scope.client.GET("/api/v1/motorcycles/{motorcycle_id}/services/", nested));
  if (tab === "responsibility")
    return unwrap(
      await scope.client.GET("/api/v1/motorcycles/{motorcycle_id}/responsibility-letters/", nested),
    );
  if (tab === "fuel")
    return unwrap(
      await scope.client.GET("/api/v1/fuel-loads/", {
        params: { query: fuelParams(state, motorcycle) },
        signal,
      }),
    );
  return readIncidents(scope, { motorcycle, state }, signal);
}
async function readIncidents(
  scope: FleetRecordScope,
  target: { motorcycle: string; state: TableState },
  signal: AbortSignal,
) {
  const { motorcycle, state } = target;
  const page = unwrap(
    await scope.client.GET("/api/v1/incidents/", {
      params: { query: { ...params(state), kind: "fleet", motorcycle } },
      signal,
    }),
  );
  if (page.results.some((row) => !("motorcycle" in row) || row.motorcycle !== motorcycle))
    throw new Error("Unproved fleet incident parent");
  return {
    ...page,
    results: page.results.filter((row): row is Schemas["Incident"] => "motorcycle" in row),
  };
}
/** The exact parent and accepted server facets are fenced before and after each response. */
export function fleetHistoryOptions(
  scope: FleetRecordScope,
  target: { motorcycle: string; tab: HistoryTab },
  state: TableState,
) {
  return fleetScopedOptions(scope, ["fleet", "history", target, state], async ({ signal }) => {
    const page = await readHistory(scope, { ...target, state }, signal);
    if (page.results.some((row) => row.motorcycle !== target.motorcycle))
      throw new Error("Unproved fleet history parent");
    return page;
  });
}
