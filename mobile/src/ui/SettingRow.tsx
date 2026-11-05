import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";

/** Design: settings rows are at least 60 dp high (`.set`). */
const MIN_HEIGHT = 60;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: MIN_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[1.5],
      paddingHorizontal: spacing[2] - 2,
      paddingVertical: spacing[1],
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: radius.md,
    },
    text: { flex: 1 },
  });

interface SettingRowProps {
  readonly title: string;
  readonly hint?: string;
  /** The control on the right (a switch, buttons). */
  readonly control: ReactNode;
}

export function SettingRow({ title, hint, control }: SettingRowProps) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        {hint === undefined ? null : (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        )}
      </View>
      {control}
    </View>
  );
}
