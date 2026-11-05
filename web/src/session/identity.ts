import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";

/**
 * Who (user) and where (organization) the cached data belongs to. When a new `/me/` names another
 * user or organization (re-authentication landing elsewhere, another tab, a revoked membership)
 * the cache of the old one is dropped and the shell is told to run the route guards again (all by the controller).
 */
type Listener = () => void;

/** The identity usable now. Forgotten (moved to `lastVerified`) whenever the session is left. */
const known = new WeakMap<QueryClient, string>();
/** The last identity that was verified, kept after leaving `known` to tell "same user again" from "another". */
const lastVerified = new WeakMap<QueryClient, string>();
const listeners = new Set<Listener>();

function identityOf(me: Me): string {
  return `${me.user.id}|${me.organization?.slug ?? ""}`;
}

/**
 * Remembers the identity of a fresh `/me/` (the controller calls it when it commits). Returns
 * whether it names ANOTHER identity than the one recorded: then the controller changes the epoch,
 * removes the org-scoped data and calls `notifyIdentityChange` (the shell re-runs the route guards).
 */
export function recordIdentity(queryClient: QueryClient, me: Me): boolean {
  const next = identityOf(me);
  const previous = known.get(queryClient) ?? lastVerified.get(queryClient);
  known.set(queryClient, next);
  lastVerified.delete(queryClient);
  return previous !== undefined && previous !== next;
}

/** Tells the shell that the identity changed (it runs the route guards again). */
export function notifyIdentityChange(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

/**
 * Whether `userId` and `organizationSlug` are the identity the cache currently holds (the last
 * `/me/` recorded). Nothing recorded (forgotten when the session was left, or never learned)
 * does NOT match: only a verified `/me/` makes an identity usable.
 */
export function isRecordedIdentity(
  queryClient: QueryClient,
  userId: string,
  organizationSlug: string,
): boolean {
  return known.get(queryClient) === `${userId}|${organizationSlug}`;
}

/** The session was left: no identity is usable until a verified `/me/` records one. */
export function forgetIdentity(queryClient: QueryClient): void {
  const current = known.get(queryClient);
  if (current !== undefined) lastVerified.set(queryClient, current);
  known.delete(queryClient);
}

export function subscribeToIdentityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
