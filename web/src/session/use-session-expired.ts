import { useSyncExternalStore } from "react";
import { isSessionExpired, subscribeToSessionExpiry } from "./session-events";

/** Whether the session ended while the user was working (a 401 after sign-in). */
export function useSessionExpired(): boolean {
  return useSyncExternalStore(subscribeToSessionExpiry, isSessionExpired);
}
