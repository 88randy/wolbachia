import { useSyncExternalStore } from "react";
import { LOADING_DELAY_MS, useDelayedFlag } from "../ui/use-delayed-flag";
import { isVerifyingOnly, sessionState, subscribeToRevision } from "./session-revision";
import type { SessionState } from "./session-revision";

/**
 * The session state as the UI should SHOW it. A window focus only checks `/me/` (`isVerifyingOnly`:
 * nothing is known to have changed, no data was cleared), so for the first moments it is still
 * `known` to the eye: no blocking dialog, no inert page, no skeleton. A real change (a leave, a
 * failure, another identity) is shown at once. Queries and mutations keep reading the strict
 * `isSessionKnown`; this is presentation only.
 */
export function useVisibleSessionState(): SessionState {
  const state = useSyncExternalStore(subscribeToRevision, sessionState);
  const isCheckOnly = useSyncExternalStore(subscribeToRevision, isVerifyingOnly);
  const isShown = useDelayedFlag(isCheckOnly, LOADING_DELAY_MS);
  return isCheckOnly && !isShown ? "known" : state;
}

/** `isSettled` of an identity, for deciding what to draw (never for gating a request). */
export function useDisplaySettled(isSettled: boolean): boolean {
  const isCheckOnly = useSyncExternalStore(subscribeToRevision, isVerifyingOnly);
  const isShown = useDelayedFlag(isCheckOnly, LOADING_DELAY_MS);
  return isSettled || (isCheckOnly && !isShown);
}
