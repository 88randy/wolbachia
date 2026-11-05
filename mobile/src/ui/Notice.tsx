import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-paths.ts";

export type NoticeTone = "info" | "warning" | "critical";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    notice: {
      flexDirection: "row",
      gap: spacing[1.5],
      padding: spacing[1.5],
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: "flex-start",
    },
    info: {
      backgroundColor: theme.color.status.info.bg,
      borderColor: theme.color.status.info.fg,
    },
    warning: {
      backgroundColor: theme.color.status.warning.bg,
      borderColor: theme.color.status.warning.fg,
    },
    critical: {
      backgroundColor: theme.color.status.critical.bg,
      borderColor: theme.color.status.critical.fg,
    },
    text: { flex: 1 },
  });

interface NoticeProps {
  readonly tone: NoticeTone;
  readonly icon: IconName;
  readonly message: string;
}

/** A message in a box (design `.nt`): an icon and plain words, never color alone. */
export function Notice({ tone, icon, message }: NoticeProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  return (
    <View style={[styles.notice, styles[tone]]} accessibilityRole="alert">
      <Icon name={icon} color={theme.color.status[tone].fg} />
      <View style={styles.text}>
        <AppText>{message}</AppText>
      </View>
    </View>
  );
}
