import { CloseShiftScreen } from "../features/shift-close/CloseShiftScreen.tsx";
import { LifecycleRoute } from "../features/ovitrap-lifecycle/LifecycleRoute.tsx";
import { P9Screen } from "../features/day/P9Screen.tsx";
import { P10Screen } from "../features/day/P10Screen.tsx";
import { OvitrapScreen } from "../features/ovitrap-check/OvitrapScreen.tsx";
import { ScannerScreen } from "../features/ovitrap-check/ScannerScreen.tsx";
import { P11Screen } from "../features/scanner/P11Screen.tsx";
import { P12Screen } from "../features/scanner/P12Screen.tsx";
import { P18Screen } from "../features/releases/P18Screen.tsx";
import { P20Screen } from "../features/samples/P20Screen.tsx";
import { OpenShiftScreen } from "../features/shift-open/OpenShiftScreen.tsx";
import { P8Screen } from "../features/supply-receipt/P8Screen.tsx";
import { P22Screen } from "../features/fuel/P22Screen.tsx";
import { P23Screen } from "../features/incidents/P23Screen.tsx";
import { P24Screen } from "../features/incidents/P24Screen.tsx";
import { P29Screen } from "../features/history/P29Screen.tsx";
import { P30Screen } from "../features/training/P30Screen.tsx";
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
  qrScanner: P11Screen,
  map: P10Screen,
  ovitrapCapture: OvitrapScreen,
  openShift: OpenShiftScreen,
  closeShift: CloseShiftScreen,
  supplyReceipt: P8Screen,
  fuel: P22Screen,
  incidents: P23Screen,
  emergency: P24Screen,
  home: HomeScreen,
  inbox: InboxScreen,
  settings: SettingsScreen,
  history: P29Screen,
  training: P30Screen,
  stylePreview: DEV_TOOLS_ENABLED ? StylePreviewScreen : HomeScreen,
};

function screenFor(route: Route): ReactNode {
  if ("ovitrapId" in route) return <LifecycleRoute route={route} />;
  if (route.name === "supplyDetail") return <P12Screen lotId={route.lotId} />;
  if (route.name === "releaseCapture")
    return (
      <P18Screen key={`${route.taskId ?? "none"}:${route.deviceId ?? "none"}`} selection={route} />
    );
  if (route.name === "sampleCapture")
    return <P20Screen key={JSON.stringify(route)} selection={route} />;
  if (route.name === "ovitrapScanner")
    return (
      <ScannerScreen
        key={`${route.target}:${route.eventId ?? "none"}`}
        target={route.target}
        eventId={route.eventId}
      />
    );
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
