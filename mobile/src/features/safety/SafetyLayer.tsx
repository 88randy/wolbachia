import { StyleSheet, View } from "react-native";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { GlobalStateList } from "./GlobalStateList.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { GlobalCause } from "./global-state.ts";
import { P32Screen } from "./P32Screen.tsx";
import { useSafety } from "./SafetyProvider.tsx";

const GPS_CAUSES: readonly GlobalCause[] = ["gpsSearching", "gpsNoFix", "gpsUnreliable"];
/** Screens whose own step already tells the location status; the global banner would repeat it. */
const OWN_LOCATION_STATUS = new Set(["ovitrapCapture"]);

const styles = StyleSheet.create({ root: { flex: 1 }, screen: { flex: 1 } });

/**
 * Global banners flow above the screen (never over it), so they cannot hide a blocker. The speed
 * lock covers the screen but keeps it mounted, so drafts are preserved and unreachable by touch.
 */
export function SafetyLayer({ children }: { readonly children: ReactNode }) {
  const { safety, rules, globals, isSpeedLocked } = useSafety();
  const insets = useSafeAreaInsets();
  const { route } = useNavigation();
  const hidesGps = OWN_LOCATION_STATUS.has(route.name);
  const banners = globals.filter(
    (state) => state.cause !== "speedLock" && !(hidesGps && GPS_CAUSES.includes(state.cause)),
  );
  const hasBanners = banners.length > 0;
  // Banners sit under the status bar; the screen below then must not pad the status bar again.
  const screenInsets = useMemo(
    () => (hasBanners ? { ...insets, top: 0 } : insets),
    [hasBanners, insets],
  );
  return (
    <View style={styles.root}>
      {hasBanners ? (
        <View style={{ paddingTop: insets.top }}>
          <GlobalStateList states={banners} />
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={screenInsets}>
        <View
          style={styles.screen}
          pointerEvents={isSpeedLocked ? "none" : "auto"}
          accessibilityElementsHidden={isSpeedLocked}
          importantForAccessibility={isSpeedLocked ? "no-hide-descendants" : "auto"}
        >
          {children}
        </View>
      </SafeAreaInsetsContext.Provider>
      {isSpeedLocked ? <P32Screen safety={safety} rules={rules} /> : null}
    </View>
  );
}
