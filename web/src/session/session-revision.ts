/**
 * Which session the page is in, as a counter instead of clocks or flags. The revision changes
 * ONLY when a login is accepted (login page or re-authentication) and when a sign-out is
 * confirmed by the server. Anything that began before a change can ask "is this still my
 * session?" by comparing revisions, with no dependence on timing.
 *
 * After a confirmed sign-out the page is "signed out" until the next accepted login: a late 401
 * from a request of the closed session is then not an expiry (nothing to re-authenticate).
 */
let revision = 0;
let isSignedOut = false;

export function currentRevision(): number {
  return revision;
}

/** A login was accepted (its `/me/` is being stored). */
export function acceptSession(): number {
  revision += 1;
  isSignedOut = false;
  return revision;
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
