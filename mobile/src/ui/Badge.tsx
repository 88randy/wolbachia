import { mobileLayout, radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-paths.ts";

export type BadgeTone = "success" | "warning" | "critical" | "info" | "neutral";

/** Design: badges are 28 dp high with a 16 dp icon (`.bd`). Status is icon + text, never color alone. */
const MIN_HEIGHT = 28;
const ICON_SIZE = 16;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      minHeight: MIN_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: mobileLayout.compactGap,
      paddingHorizontal: spacing[1.5] - 2,
      paddingVertical: 2,
      borderRadius: radius.lg,
    },
    success: { backgroundColor: theme.color.status.success.bg },
    warning: { backgroundColor: theme.color.status.warning.bg },
    critical: { backgroundColor: theme.color.status.critical.bg },
    info: { backgroundColor: theme.color.status.info.bg },
    neutral: { backgroundColor: theme.color.status.neutral.bg },
  });

interface BadgeProps {
  readonly tone: BadgeTone;
  readonly icon: IconName;
  readonly label: string;
}

export function Badge({ tone, icon, label }: BadgeProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  const color = theme.color.status[tone].fg;
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Icon name={icon} color={color} size={ICON_SIZE} />
      <AppText variant="captionStrong" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}
