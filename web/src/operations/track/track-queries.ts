import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { useCan } from "../../session/use-can";
import { useSessionIdentity } from "../../session/use-session-identity";
import { TRACK_PERMISSION } from "./track-model";

/** Same cadence as the W28 shift list. */
const POSITIONS_REFRESH_MS = 30_000;

/** Last position of every readable open shift; never asked without `courier_track.read`. */
export function useCourierPositions() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const canTrack = useCan()(TRACK_PERMISSION);
  const options = orgScopedQueryOptions(identity, {
    key: ["shifts", "positions"],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/shifts/positions/", { signal })),
  });
  const query = useQuery({
    ...options,
    enabled: options.enabled && canTrack,
    refetchInterval: POSITIONS_REFRESH_MS,
  });
  return { canTrack, query };
}

/** The track of one shift; `refetchInterval` keeps a followed courier current. */
export function useShiftTrack(shiftId: string | undefined, refetchInterval?: number) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const canTrack = useCan()(TRACK_PERMISSION);
  const id = shiftId ?? "";
  const options = orgScopedQueryOptions(identity, {
    key: ["shifts", "track", id],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/shifts/{id}/track/", { params: { path: { id } }, signal })),
  });
  const query = useQuery({
    ...options,
    enabled: options.enabled && canTrack && id !== "",
    refetchInterval,
  });
  return { canTrack, query };
}
