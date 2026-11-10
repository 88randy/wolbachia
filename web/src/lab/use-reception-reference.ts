import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { labScopeOptions } from "./reception-query";
import { useReceptionScope } from "./use-reception-scope";

/** Resolve an opaque receipt subject only through its current authorized resource. */
export function useReceptionBagCode(id: string) {
  const scope = useReceptionScope();
  return useQuery(
    labScopeOptions(scope, ["bag", id], async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/bags/{id}/", { params: { path: { id } }, signal })),
    ),
  );
}

/** Incident IDs resolve to human codes before building their web record route. */
export function useReceptionIncident(id: string) {
  const scope = useReceptionScope();
  const query = useQuery(
    labScopeOptions(scope, ["incident", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incidents/{id}/", { params: { path: { id } }, signal }),
      ),
    ),
  );
  return {
    ...query,
    retry: () => {
      void query.refetch();
    },
  };
}
