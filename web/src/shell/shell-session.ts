import {
  isSessionKnown,
  isSignedOutSession,
  subscribeToRevision,
} from "../session/session-revision";
import { isSessionExpired, subscribeToSessionExpiry } from "../session/session-events";
/** Shell commands only belong to an authenticated, usable page. */
export function isShellSessionAvailable(): boolean {
  return isSessionKnown() && !isSessionExpired() && !isSignedOutSession();
}
export function subscribeToShellSession(listener: () => void): () => void {
  const removeRevision = subscribeToRevision(listener);
  const removeExpiry = subscribeToSessionExpiry(listener);
  return () => {
    removeRevision();
    removeExpiry();
  };
}
