import { broadcastSessionChanged } from "./session-sync";

/**
 * Which session the page is in, as a counter instead of clocks. The revision changes ONLY when a
 * login is accepted (login page or re-authentication), when a sign-out is confirmed by the
 * server, when `/me/` names another identity (`changeIdentity`) and when another tab announces
 * that it changed the shared session (#82). It is the ONLY staleness signal: never compare
 * against React-rendered state, which lags behind. Anything that began before a change can ask
 * "is this still my session?" by comparing
 * revisions, with no dependence on timing.
 *
 * After a confirmed sign-out the page is "signed out" until the next accepted login or a valid
 * `/me/` that started after it: a late 401 from a request of the closed session is then not an
 * expiry (nothing to re-authenticate).
 */
type Listener = () => void;

let revision = 0;
let isSignedOut = false;
let reconciling = 0;
let isUnknown = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function bump(): void {
  revision += 1;
  emit();
}

/** Calls `listener` when the revision or the reconciling state changes (React: `useSyncExternalStore`). */
export function subscribeToRevision(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentRevision(): number {
  return revision;
}

/** A login was accepted (its `/me/` is being stored). */
export function acceptSession(): void {
  bump();
  isSignedOut = false;
  broadcastSessionChanged();
}

/**
 * A valid `/me/` that started after the sign-out proves a session exists again (another tab
 * signed in, cookies are shared). Leaves the signed-out state WITHOUT changing the revision:
 * this tab did not log in.
 */
export function recoverSession(): void {
  isSignedOut = false;
}

/**
 * `/me/` named another user or organization than the cache holds (`recordIdentity`). Bumps the
 * revision SYNCHRONOUSLY, in the same call that swaps the identity, so a request that began under
 * the old one is stale from that instant, before React or TanStack notify anybody.
 */
export function changeIdentity(): void {
  bump();
}

/** The server confirmed the sign-out. Returns the new revision. */
export function confirmSignOut(): number {
  bump();
  isSignedOut = true;
  broadcastSessionChanged();
  return revision;
}

/**
 * ANOTHER tab changed the session (shared cookie): what this tab holds may belong to a different
 * identity. The revision changes, so everything that began before is discarded, and the tab is
 * "reconciling" (org-scoped queries wait) until `/me/` says who it is now.
 */
export function beginExternalChange(): void {
  reconciling += 1;
  bump();
}

/** `/me/` answered (or failed) after an external change: org-scoped queries may run again. */
export function endExternalChange(): void {
  reconciling = Math.max(0, reconciling - 1);
  emit();
}

/** True while at least one external change is waiting for `/me/`. */
export function isReconcilingSession(): boolean {
  return reconciling > 0;
}

/**
 * The session check failed (`/me/` unreachable while reconciling): the tab does not know who it
 * is. State rule (#82): identity is known(user, org, revision) | reconciling | unknown, and
 * org-scoped queries and mutations run ONLY in `known`. The tab never falls back to the identity
 * it had before: it blocks and asks the user to retry.
 */
export function markSessionUnknown(): void {
  isUnknown = true;
  emit();
}

/** `/me/` answered: the identity is known again. */
export function clearSessionUnknown(): void {
  isUnknown = false;
  emit();
}

export function isSessionUnknown(): boolean {
  return isUnknown;
}

/** True between a confirmed sign-out and the next accepted login. */
export function isSignedOutSession(): boolean {
  return isSignedOut;
}

/** Tests only: module state must not leak between them. */
export function resetSessionRevision(): void {
  revision = 0;
  isSignedOut = false;
  reconciling = 0;
  isUnknown = false;
}
