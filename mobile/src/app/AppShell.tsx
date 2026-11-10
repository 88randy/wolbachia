import { AuthGate } from "./AuthGate.tsx";

import { SafetyLayer } from "../features/safety/SafetyLayer.tsx";
import { SafetyProvider } from "../features/safety/SafetyProvider.tsx";
import { NavigationProvider } from "../navigation/NavigationProvider.tsx";
import { ScreenRouter } from "../navigation/ScreenRouter.tsx";
import { useSyncLifecycle } from "../sync/use-sync-lifecycle.ts";

/** The running app: starts the sync worker and shows the navigation. */
export function AppShell() {
  useSyncLifecycle();
  return (
    <SafetyProvider>
      <NavigationProvider>
        <AuthGate>
          <SafetyLayer>
            <ScreenRouter />
          </SafetyLayer>
        </AuthGate>
      </NavigationProvider>
    </SafetyProvider>
  );
}
