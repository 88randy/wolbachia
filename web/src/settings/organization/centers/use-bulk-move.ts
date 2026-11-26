import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useCentersScope } from "./use-centers-scope";
import type { MoveResult } from "./centers-api";

export type BulkMoveKind = "motorcycles" | "stock";

/** One bulk step of the close flow; per-item results come back for display and retry. */
export function useBulkMove(centerId: string, kind: BulkMoveKind) {
  const scope = useCentersScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (destination: string): Promise<MoveResult[]> => {
      const path = { params: { path: { id: centerId } } };
      const answer =
        kind === "motorcycles"
          ? await scope.client.POST("/api/v1/centers/{id}/move-motorcycles/", {
              ...path,
              body: { destination_center: destination },
            })
          : await scope.client.POST("/api/v1/centers/{id}/move-stock/", {
              ...path,
              body: { destination_location: destination },
            });
      return unwrap(answer).results;
    },
    onSettled: () => {
      // Readiness, the center counts and the fleet / inventory lists all changed.
      void queryClient.invalidateQueries();
    },
  });
}
