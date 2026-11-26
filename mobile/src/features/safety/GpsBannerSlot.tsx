import { StyleSheet, View } from "react-native";

import { GlobalStateList } from "./GlobalStateList.tsx";
import type { GlobalState } from "./global-state.ts";

/** Fills a reserved slot invisibly, so the slot keeps the height of the real banner. */
const PLACEHOLDER: readonly GlobalState[] = [
  { cause: "gpsUnreliable", level: "info", nextAction: "waitForFix" },
];

const styles = StyleSheet.create({ hidden: { opacity: 0 } });

/**
 * The GPS banner, or while its slot is reserved an invisible copy of the same height: the
 * banner coming and going never moves what is below it.
 */
export function GpsBannerSlot({
  states,
  isReserved,
}: {
  readonly states: readonly GlobalState[];
  readonly isReserved: boolean;
}) {
  if (states.length > 0) return <GlobalStateList states={states} />;
  if (!isReserved) return null;
  return (
    <View
      style={styles.hidden}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <GlobalStateList states={PLACEHOLDER} />
    </View>
  );
}
