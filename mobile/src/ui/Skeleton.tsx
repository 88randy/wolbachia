import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useStyles } from "../theme/ThemeProvider.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    line: {
      height: spacing[2],
      borderRadius: radius.sm,
      backgroundColor: theme.color.surfaceMuted,
    },
    short: { width: "60%" },
  });

/** Static local-load placeholder: no loop or blur on low-end devices or reduced-motion users. */
export function Skeleton({ isShort = false }: { readonly isShort?: boolean }) {
  const styles = useStyles(createStyles);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.line, isShort ? styles.short : null]}
    />
  );
}
