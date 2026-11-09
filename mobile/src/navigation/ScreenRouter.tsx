import { LifecycleRoute } from "../features/ovitrap-lifecycle/LifecycleRoute.tsx";
import { P9Screen } from "../features/day/P9Screen.tsx";
import { P10Screen } from "../features/day/P10Screen.tsx";
import { OvitrapScreen } from "../features/ovitrap-check/OvitrapScreen.tsx";
import { ScannerScreen } from "../features/ovitrap-check/ScannerScreen.tsx";
import { P21Screen } from "../features/ovitrap-check/P21Screen.tsx";
import { OpenShiftScreen } from "../features/shift-open/OpenShiftScreen.tsx";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";

import { HomeScreen } from "../screens/HomeScreen.tsx";
import { InboxScreen } from "../screens/InboxScreen.tsx";
import { SettingsScreen } from "../screens/SettingsScreen.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { useNavigation } from "./NavigationProvider.tsx";
import type { Route } from "./routes.ts";

function screenFor(route: Route): ReactNode {
  if ("ovitrapId" in route) return <LifecycleRoute route={route} />;
  return mainScreenFor(route);
}
function mainScreenFor(route: Exclude<Route, { readonly ovitrapId: string }>): ReactNode {
  switch (route.name) {
    case "day":
      return <P9Screen />;
    case "map":
      return <P10Screen />;
    case "ovitrapCapture":
      return <OvitrapScreen />;
    case "ovitrapScanner":
      return <ScannerScreen target={route.target} />;
    case "invalidOvitrapCode":
      return <P21Screen target={route.target} />;
    case "openShift":
      return <OpenShiftScreen />;
    case "home":
      return <HomeScreen />;
    case "inbox":
      return <InboxScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

/**
 * Shows the screen on top of the stack. The home screen has the navy top bar (light status icons);
 * the inner screens have a surface header (icons follow the theme).
 */
export function ScreenRouter() {
  const { route } = useNavigation();
  const { scheme } = useTheme();
  const hasNavyBar = route.name === "home";
  const statusStyle = hasNavyBar || scheme === "dark" ? "light" : "dark";
  return (
    <>
      <StatusBar style={statusStyle} />
      {screenFor(route)}
    </>
  );
}
