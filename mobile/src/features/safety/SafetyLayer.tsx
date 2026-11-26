import { StyleSheet, View } from "react-native";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { GlobalStateList } from "./GlobalStateList.tsx";
import { GpsBannerSlot } from "./GpsBannerSlot.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { GPS_INFO_CAUSES, keepsGpsSlot } from "./global-state.ts";
import type { GlobalState } from "./global-state.ts";
import { P32Screen } from "./P32Screen.tsx";
import { useSafety } from "./SafetyProvider.tsx";

/** Screens whose own step already tells the location status; the global banner would repeat it. */
const OWN_LOCATION_STATUS = new Set(["ovitrapCapture"]);

const styles = StyleSheet.create({ root: { flex: 1 }, screen: { flex: 1 } });

interface Banners {
  readonly others: readonly GlobalState[];
  readonly gps: readonly GlobalState[];
  readonly isGpsReserved: boolean;
  /** A shown GPS banner always reserves its slot, so this covers it. */
  readonly hasAny: boolean;
}

/** Splits the GPS info banner into its own slot, which stays once shown (see keepsGpsSlot). */
function useBanners(globals: readonly GlobalState[], isWatching: boolean): Banners {
  const { route } = useNavigation();
  const hidesGps = OWN_LOCATION_STATUS.has(route.name);
  const gps = hidesGps ? [] : globals.filter((state) => GPS_INFO_CAUSES.includes(state.cause));
  const [wasReserved, setWasReserved] = useState(false);
  const isGpsReserved = keepsGpsSlot(wasReserved, gps.length > 0, isWatching && !hidesGps);
  if (isGpsReserved !== wasReserved) setWasReserved(isGpsReserved);
  const others = globals.filter(
    (state) => state.cause !== "speedLock" && !GPS_INFO_CAUSES.includes(state.cause),
  );
  return { others, gps, isGpsReserved, hasAny: others.length > 0 || isGpsReserved };
}

/**
 * Global banners flow above the screen (never over it), so they cannot hide a blocker. The speed
 * lock covers the screen but keeps it mounted, so drafts are preserved and unreachable by touch.
 */
export function SafetyLayer({ children }: { readonly children: ReactNode }) {
  const { safety, rules, globals, isSpeedLocked, location } = useSafety();
  const insets = useSafeAreaInsets();
  const banners = useBanners(globals, location.kind !== "unavailable");
  // Banners sit under the status bar; the screen below then must not pad the status bar again.
  const screenInsets = useMemo(
    () => (banners.hasAny ? { ...insets, top: 0 } : insets),
    [banners.hasAny, insets],
  );
  return (
    <View style={styles.root}>
      {banners.hasAny ? (
        <View style={{ paddingTop: insets.top }}>
          <GlobalStateList states={banners.others} />
          <GpsBannerSlot states={banners.gps} isReserved={banners.isGpsReserved} />
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
