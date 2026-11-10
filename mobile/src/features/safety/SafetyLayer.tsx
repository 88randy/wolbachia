import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { GlobalStateList } from "./GlobalStateList.tsx";
import { P32Screen } from "./P32Screen.tsx";
import { useSafety } from "./SafetyProvider.tsx";

const styles = StyleSheet.create({ root: { flex: 1 }, screen: { flex: 1 } });

/**
 * Global banners flow above the screen (never over it), so they cannot hide a blocker. The speed
 * lock covers the screen but keeps it mounted, so drafts are preserved and unreachable by touch.
 */
export function SafetyLayer({ children }: { readonly children: ReactNode }) {
  const { safety, rules, globals, isSpeedLocked } = useSafety();
  return (
    <View style={styles.root}>
      <GlobalStateList states={globals.filter((state) => state.cause !== "speedLock")} />
      <View
        style={styles.screen}
        pointerEvents={isSpeedLocked ? "none" : "auto"}
        accessibilityElementsHidden={isSpeedLocked}
        importantForAccessibility={isSpeedLocked ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {isSpeedLocked ? <P32Screen safety={safety} rules={rules} /> : null}
    </View>
  );
}
