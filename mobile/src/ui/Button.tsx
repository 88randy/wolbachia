import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { ButtonContent } from "./ButtonContent.tsx";
import type { IconName } from "./icon-paths.ts";

export type ButtonVariant = "primary" | "outline" | "text";

/** Design: buttons are at least 56 dp high (`.btn`), text buttons 48 dp. */
const MIN_HEIGHT = 56;
const OUTLINE_WIDTH = 2;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: MIN_HEIGHT,
      borderRadius: radius.inner,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
    },
    primary: {
      backgroundColor: theme.color.action,
      borderWidth: OUTLINE_WIDTH,
      borderColor: theme.color.action,
    },
    outline: {
      backgroundColor: theme.color.surface,
      borderWidth: OUTLINE_WIDTH,
      borderColor: theme.color.action,
    },
    text: {},
    disabled: { backgroundColor: theme.color.disabled.background },
    primaryPressed: { borderColor: theme.color.actionStrong },
    secondaryPressed: { borderColor: theme.color.actionStrong, backgroundColor: theme.color.tint },
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
  const color = buttonColor({ theme, disabled, variant });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled ? styles.disabled : null,
        pressed ? (variant === "primary" ? styles.primaryPressed : styles.secondaryPressed) : null,
      ]}
    >
      <ButtonContent icon={icon} color={color} label={label} />
    </Pressable>
  );
}

function buttonColor({
  theme,
  disabled,
  variant,
}: {
  theme: Theme;
  disabled: boolean;
  variant: ButtonVariant;
}) {
  if (disabled) return theme.color.text.secondary;
  return variant === "primary" ? theme.color.onAction : theme.color.actionStrong;
}
