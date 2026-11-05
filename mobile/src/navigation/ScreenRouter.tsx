import { P9Screen } from "../features/day/P9Screen.tsx";
import { P10Screen } from "../features/day/P10Screen.tsx";
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
  switch (route.name) {
    case "day":
      return <P9Screen />;
    case "map":
      return <P10Screen />;
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
