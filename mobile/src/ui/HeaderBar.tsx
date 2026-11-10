import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      backgroundColor: theme.color.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.soft,
      minHeight: spacing[6] + spacing[2],
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingBottom: spacing[1],
    },
    title: { flexGrow: 1, flexBasis: spacing[6] * 2 },
  });

/** The shared surface header wraps its title and status instead of clipping large text. */
export function HeaderBar({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing[1] }]}>
      <View style={styles.title}>
        <AppText variant="button" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}
