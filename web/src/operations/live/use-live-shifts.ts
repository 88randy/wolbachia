import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { useSessionIdentity } from "../../session/use-session-identity";
import {
  assignmentsOptions,
  MAX_PAGE,
  quadrantsOptions,
} from "../../scheduling/scheduling-queries";

const REFRESH_MS = 30_000;

/** Open shifts, refreshed every 30 seconds, with the quadrants each courier works today. */
export function useLiveShifts(selectedCourier: string | undefined) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const shiftOptions = orgScopedQueryOptions(identity, {
    key: ["shifts", "live"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/shifts/", {
          params: { query: { status: "open", page_size: MAX_PAGE } },
          signal,
        }),
      ).results,
  });
  const shifts = useQuery({ ...shiftOptions, refetchInterval: REFRESH_MS });
  const assignments = useQuery(assignmentsOptions(client, identity));
  const quadrants = useQuery(quadrantsOptions(client, identity));
  const open = shifts.data ?? [];
  const working = new Set(open.map((shift) => shift.courier));
  const chosen = selectedCourier ? new Set([selectedCourier]) : working;
  const codes = new Set(
    (assignments.data?.results ?? [])
      .filter((row) => row.courier !== null && chosen.has(row.courier))
      .map((row) => row.quadrant),
  );
  return {
    shifts: open,
    isPending: shifts.isPending,
    isError: shifts.isError,
    isFetching: shifts.isFetching,
    refetch: () => void shifts.refetch(),
    quadrantsOf: (courier: string) =>
      (assignments.data?.results ?? []).filter((row) => row.courier === courier),
    mapQuadrants: (quadrants.data ?? []).filter((quadrant) => codes.has(quadrant.id)),
  };
}
