import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStyles } from "../theme/ThemeProvider.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    footer: {
      padding: spacing[2],
      gap: spacing[1],
      backgroundColor: theme.color.surface,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.soft,
    },
  });

/** A full-width thumb-zone action group that clears the Android gesture/navigation area. */
export function BottomActions({ children }: { readonly children: ReactNode }) {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[2] }]}>{children}</View>
  );
}
