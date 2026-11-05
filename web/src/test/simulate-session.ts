import { bumpEpoch, currentRevision, setSignedOut } from "../session/session-revision";

/**
 * Stands in for the other writers in tests that only need "the session moved": the real ones go
 * through the session controller (`commitKnown`, `commitSignedOut`), which needs a query client.
 */
export function simulateLogin(): void {
  bumpEpoch();
  setSignedOut(false);
}

/** Returns the new epoch, like `commitSignedOut`. */
export function simulateSignOut(): number {
  bumpEpoch();
  setSignedOut(true);
  return currentRevision();
}
