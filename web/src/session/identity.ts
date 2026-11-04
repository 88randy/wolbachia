import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { removeOrganizationQueries } from "./organization-cache";

/**
 * Who (user) and where (organization) the cached data belongs to. When a new `/me/` names another
 * user or organization (re-authentication landing elsewhere, another tab, a revoked membership)
 * the cache of the old one is dropped and the shell is told to run the route guards again.
 */
type Listener = () => void;

const known = new WeakMap<QueryClient, string>();
const listeners = new Set<Listener>();

function identityOf(me: Me): string {
  return `${me.user.id}|${me.organization?.slug ?? ""}`;
}

/**
 * Remembers the identity of a fresh `/me/`. SIDE EFFECTS when it differs from the last one: it
 * removes every cached query except `/me/` and notifies the listeners (the shell re-runs the
 * route guards).
 */
export function recordIdentity(queryClient: QueryClient, me: Me): void {
  const next = identityOf(me);
  const previous = known.get(queryClient);
  known.set(queryClient, next);
  if (previous === undefined || previous === next) return;
  removeOrganizationQueries(queryClient);
  listeners.forEach((listener) => {
    listener();
  });
}

/** Nobody is signed in any more (the cache was cleared). */
export function forgetIdentity(queryClient: QueryClient): void {
  known.delete(queryClient);
}

export function subscribeToIdentityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
