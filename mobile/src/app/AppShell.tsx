import { InAppCameraHost } from "../attachments/InAppCameraHost.tsx";
import { AuthGate } from "./AuthGate.tsx";

import { SafetyLayer } from "../features/safety/SafetyLayer.tsx";
import { SafetyProvider } from "../features/safety/SafetyProvider.tsx";
import { NavigationProvider } from "../navigation/NavigationProvider.tsx";
import { ScreenRouter } from "../navigation/ScreenRouter.tsx";
import { useSyncLifecycle } from "../sync/use-sync-lifecycle.ts";
import { ThemeVarsRoot } from "../ui/ThemeVarsRoot.tsx";

/** The running app: starts the sync worker and shows the navigation. */
export function AppShell() {
  useSyncLifecycle();
  return (
    <ThemeVarsRoot>
      <SafetyProvider>
        <NavigationProvider>
          <AuthGate>
            <SafetyLayer>
              <ScreenRouter />
              <InAppCameraHost />
            </SafetyLayer>
          </AuthGate>
        </NavigationProvider>
      </SafetyProvider>
    </ThemeVarsRoot>
  );
}
