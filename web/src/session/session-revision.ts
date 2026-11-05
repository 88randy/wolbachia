/**
 * Which session the page is in, as a counter instead of clocks. The revision changes ONLY when a
 * login is accepted (login page or re-authentication), when a sign-out is confirmed by the
 * server and when `/me/` names another identity (`changeIdentity`). It is the ONLY staleness
 * signal: never compare against React-rendered state, which lags behind. Anything that began before a change can ask "is this still my session?" by comparing
 * revisions, with no dependence on timing.
 *
 * After a confirmed sign-out the page is "signed out" until the next accepted login or a valid
 * `/me/` that started after it: a late 401 from a request of the closed session is then not an
 * expiry (nothing to re-authenticate).
 */
let revision = 0;
let isSignedOut = false;

export function currentRevision(): number {
  return revision;
}

/** A login was accepted (its `/me/` is being stored). */
export function acceptSession(): void {
  revision += 1;
  isSignedOut = false;
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
  revision += 1;
}

/** The server confirmed the sign-out. Returns the new revision. */
export function confirmSignOut(): number {
  revision += 1;
  isSignedOut = true;
  return revision;
}

/** True between a confirmed sign-out and the next accepted login. */
export function isSignedOutSession(): boolean {
  return isSignedOut;
}

/** Tests only: module state must not leak between them. */
export function resetSessionRevision(): void {
  revision = 0;
  isSignedOut = false;
}
