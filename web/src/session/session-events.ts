import { ApiError } from "@wolbachia/api-client";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { ME_QUERY_KEY } from "./me-query";

/**
 * Things that happen to a session while the user is working, reported by the query and mutation
 * caches (every failed request passes through them) and handled by the shell.
 *
 * - expired: a 401 after the user was signed in. The shell asks for the password again over the
 *   current page, so what the user was typing is not lost.
 * - membership lost: `403 no_active_membership`. The shell forgets the organization and lets the
 *   route guards send the user to sign in or to choose an organization.
 *
 * Both are ignored while nobody is signed in (`/me/` not loaded): a 401 on the sign-in page is
 * simply "not signed in".
 */
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

type Listener = () => void;

let isExpired = false;
const expiryListeners = new Set<Listener>();
const membershipListeners = new Set<Listener>();

function notify(listeners: ReadonlySet<Listener>): void {
  listeners.forEach((listener) => {
    listener();
  });
}

export function isSessionExpired(): boolean {
  return isExpired;
}

export function markSessionExpired(): void {
  if (isExpired) return;
  isExpired = true;
  notify(expiryListeners);
}

/** The user signed in again (or out): nothing is expired any more. */
export function endSessionExpiry(): void {
  if (!isExpired) return;
  isExpired = false;
  notify(expiryListeners);
}

export function subscribeToSessionExpiry(listener: Listener): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

export function subscribeToMembershipLost(listener: Listener): () => void {
  membershipListeners.add(listener);
  return () => {
    membershipListeners.delete(listener);
  };
}

function isMeQuery(queryKey: QueryKey | undefined): boolean {
  return queryKey?.[0] === ME_QUERY_KEY[0];
}

/**
 * Called by the query and mutation caches for every failed request (`queryKey` is the failed
 * query's, absent for a mutation). A membership error of `/me/` itself is NOT reported: the route
 * guards handle it, and reporting it would make the shell refetch `/me/` forever.
 */
export function reportSessionError(
  error: unknown,
  queryClient: QueryClient,
  queryKey?: QueryKey,
): void {
  if (!(error instanceof ApiError)) return;
  if (queryClient.getQueryData(ME_QUERY_KEY) === undefined) return;
  if (error.status === HTTP_UNAUTHORIZED) markSessionExpired();
  else if (error.status === HTTP_FORBIDDEN && error.code === NO_ACTIVE_MEMBERSHIP) {
    if (!isMeQuery(queryKey)) notify(membershipListeners);
  }
}
