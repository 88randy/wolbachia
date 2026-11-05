import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GEOGRAPHY } from "./geography-query";
/** A scope-only /me change does not change the session epoch. Drop the obsolete geography context ourselves. */
export function useGeographyCache(context: string) {
  const queryClient = useQueryClient();
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[3] === GEOGRAPHY && query.queryKey[4] !== context,
    };
    void queryClient.cancelQueries(obsolete);
    queryClient.removeQueries(obsolete);
  }, [queryClient, context]);
}
