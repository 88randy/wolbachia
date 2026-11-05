import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-paths.ts";

export type ButtonVariant = "primary" | "outline" | "text";

/** Design: buttons are at least 56 dp high (`.btn`), text buttons 48 dp. */
const MIN_HEIGHT = 56;
const OUTLINE_WIDTH = 2;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: MIN_HEIGHT,
      borderRadius: radius.md,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      alignItems: "center",
      justifyContent: "center",
    },
    primary: { backgroundColor: theme.color.action },
    outline: {
      backgroundColor: theme.color.surface,
      borderWidth: OUTLINE_WIDTH,
      borderColor: theme.color.action,
    },
    text: {},
    disabled: { backgroundColor: theme.color.disabled.background },
    content: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  });

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
}: ButtonProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  const isPrimary = variant === "primary";
  const color = isPrimary ? theme.color.onAction : theme.color.actionStrong;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, styles[variant], disabled ? styles.disabled : null]}
    >
      <View style={styles.content}>
        {icon === undefined ? null : <Icon name={icon} color={color} />}
        <AppText variant="button" style={{ color }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}
