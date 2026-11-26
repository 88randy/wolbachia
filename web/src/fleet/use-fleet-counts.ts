import { useQuery } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { fleetListOptions } from "./fleet-query";
import type { FleetScope } from "./fleet-query";

function withBlocked(state: TableState, blocked?: "true" | "false"): TableState {
  const filters = { ...state.filters };
  delete filters["is_blocked"];
  return { ...state, page: 1, filters: blocked ? { ...filters, is_blocked: blocked } : filters };
}

/** Totals for the status tabs: all, available and blocked ("" is all). */
export function useFleetCounts(scope: FleetScope, state: TableState) {
  const all = useQuery(fleetListOptions(scope, withBlocked(state))).data?.count;
  const available = useQuery(fleetListOptions(scope, withBlocked(state, "false"))).data?.count;
  const blocked = useQuery(fleetListOptions(scope, withBlocked(state, "true"))).data?.count;
  if (all === undefined || available === undefined || blocked === undefined) return undefined;
  return { "": all, false: available, true: blocked };
}
