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
import { StylePreviewScreen } from "../screens/StylePreviewScreen.tsx";
import { DEV_TOOLS_ENABLED } from "../config/build-config.ts";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { useNavigation } from "./NavigationProvider.tsx";
import type { Route } from "./routes.ts";

const SCREENS = {
  day: P9Screen,
  map: P10Screen,
  ovitrapCapture: OvitrapScreen,
  openShift: OpenShiftScreen,
  home: HomeScreen,
  inbox: InboxScreen,
  settings: SettingsScreen,
  stylePreview: DEV_TOOLS_ENABLED ? StylePreviewScreen : HomeScreen,
};

function screenFor(route: Route): ReactNode {
  if ("ovitrapId" in route) return <LifecycleRoute route={route} />;
  if (route.name === "ovitrapScanner") return <ScannerScreen target={route.target} />;
  if (route.name === "invalidOvitrapCode") return <P21Screen target={route.target} />;
  const Screen = SCREENS[route.name];
  return <Screen />;
}

/** Shows the top route with status icons matching the surface header. */
export function ScreenRouter() {
  const { route } = useNavigation();
  const { scheme } = useTheme();
  const statusStyle = scheme === "dark" ? "light" : "dark";
  return (
    <>
      <StatusBar style={statusStyle} />
      {screenFor(route)}
    </>
  );
}
