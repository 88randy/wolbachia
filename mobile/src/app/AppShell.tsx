import { AuthGate } from "./AuthGate.tsx";

import { NavigationProvider } from "../navigation/NavigationProvider.tsx";
import { ScreenRouter } from "../navigation/ScreenRouter.tsx";
import { useSyncLifecycle } from "../sync/use-sync-lifecycle.ts";

/** The running app: starts the sync worker and shows the navigation. */
export function AppShell() {
  useSyncLifecycle();
  return (
    <NavigationProvider>
      <AuthGate>
        <ScreenRouter />
      </AuthGate>
    </NavigationProvider>
  );
}
