/**
 * The epoch and the state of the session (#82), as plain primitives. `session-controller.ts` is
 * the ONLY code that calls the mutators below (a test fails otherwise); everything else reads.
 *
 * - The EPOCH is a counter, never a clock. It changes whenever the tab leaves `known` (a login, a
 *   sign-out, another identity, a failed check, a 401, another tab's announcement). An operation
 *   captures it when it starts (its token) and may publish a result only while it still equals the
 *   epoch, so anything that began before a change is dead on arrival.
 * - The STATE is `known` | `reconciling` | `unknown`. Org-scoped queries and mutations run only in
 *   `known`.
 *
 * After a confirmed sign-out the page is "signed out" until the next accepted login or a valid
 * `/me/` that started after it: a late 401 from a request of the closed session is then not an
 * expiry (nothing to re-authenticate).
 */
type Listener = () => void;
export type SessionState = "known" | "reconciling" | "unknown";

let epoch = 0;
let state: SessionState = "known";
let isSignedOut = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

/** Calls `listener` when the epoch or the state changes (React: `useSyncExternalStore`). */
export function subscribeToRevision(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current epoch: what an operation captures as its token when it starts. */
export function currentRevision(): number {
  return epoch;
}

export function sessionState(): SessionState {
  return state;
}

/** The one place that says whether org-scoped work may run: only in `known`. */
export function isSessionKnown(): boolean {
  return state === "known";
}

/** True between a confirmed sign-out and the next accepted login. */
export function isSignedOutSession(): boolean {
  return isSignedOut;
}

/** Controller only: the epoch changes, so every token in flight is stale from this instant. */
export function bumpEpoch(): void {
  epoch += 1;
  emit();
}

/** Controller only. */
export function setSessionState(next: SessionState): void {
  state = next;
  emit();
}

/** Controller only. */
export function setSignedOut(next: boolean): void {
  isSignedOut = next;
}

/** Tests only: module state must not leak between them. */
export function resetSessionRevision(): void {
  epoch = 0;
  state = "known";
  isSignedOut = false;
}
