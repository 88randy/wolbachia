import type { QueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "./me-query";

/**
 * Drops every cached answer except `/me/` (which stays so mounted screens keep their observer):
 * what was loaded for another organization or user must never be shown for this one.
 */
export function removeOrganizationQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
}
