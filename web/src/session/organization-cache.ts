import type { Query, QueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "./me-key";

/**
 * The public portal belongs to no session: an anonymous visitor reads it while the session is
 * still being checked, so a session change must neither cancel nor drop it.
 */
export function isSessionQuery(query: Query): boolean {
  return query.queryKey[0] !== "portal";
}

/**
 * Drops every cached answer of the session except `/me/` (which stays so mounted screens keep
 * their observer): what was loaded for another organization or user must never be shown for this
 * one.
 */
export function removeOrganizationQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => isSessionQuery(query) && query.queryKey[0] !== ME_QUERY_KEY[0],
  });
}
