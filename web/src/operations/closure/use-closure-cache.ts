import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CLOSURE } from "./closure-query";
/** A permission-only /me change need not bump session revision; retire its old reads explicitly. */
export function useClosureCache(context: string) {
  const queryClient = useQueryClient();
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[3] === CLOSURE && query.queryKey[4] !== context,
    };
    void queryClient.cancelQueries(obsolete);
    queryClient.removeQueries(obsolete);
  }, [queryClient, context]);
}
