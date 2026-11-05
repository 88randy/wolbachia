import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { setIdentityMismatchHandler } from "./attestation";
import { reconcileSession } from "./session-reconcile";
import { subscribeToSessionChanged } from "./session-sync";
import { leaveKnown } from "./session-controller";

interface Wiring {
  queryClient: QueryClient;
  client: ApiClient;
  /** Runs the route guards again once the identity is known (the new user may not be allowed here). */
  invalidateRoutes: () => Promise<void>;
}

let uninstallCurrent: (() => void) | undefined;

/**
 * Everything that observes a change of the shared session, installed at the app root BEFORE the
 * first guard runs (#82), so a login in another tab during the initial `/me/` is never missed:
 * - another tab's announcement (BroadcastChannel / storage) reconciles with `/me/`;
 * - the tab becoming visible or focused verifies `/me/`;
 * - a response whose `X-Session-Identity` does not match leaves `known` and reconciles.
 *
 * One install per page: installing again replaces the previous one. Returns the uninstall.
 */
export function installSessionSync({ queryClient, client, invalidateRoutes }: Wiring): () => void {
  uninstallCurrent?.();
  const reconcile = (): void => {
    void reconcileSession(queryClient, client).then((isKnown) => {
      if (isKnown) return invalidateRoutes();
    });
  };
  const stopAnnouncements = subscribeToSessionChanged(reconcile);
  const verify = (): void => {
    if (document.visibilityState === "visible")
      void reconcileSession(queryClient, client, "verify");
  };
  document.addEventListener("visibilitychange", verify);
  window.addEventListener("focus", verify);
  setIdentityMismatchHandler(() => {
    void leaveKnown(queryClient);
    reconcile();
  });
  const uninstall = (): void => {
    stopAnnouncements();
    document.removeEventListener("visibilitychange", verify);
    window.removeEventListener("focus", verify);
    setIdentityMismatchHandler(undefined);
    if (uninstallCurrent === uninstall) uninstallCurrent = undefined;
  };
  uninstallCurrent = uninstall;
  return uninstall;
}

/** Tests only: no listener may outlive the test that rendered the app. */
export function uninstallSessionSync(): void {
  uninstallCurrent?.();
}
