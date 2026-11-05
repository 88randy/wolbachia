import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, TextInput } from "react-native";
import type { TextInputProps } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { textStyleFor } from "../theme/typography.ts";

/** Design: inputs are at least 56 dp high with a 2 dp border (`.in`). */
const MIN_HEIGHT = 56;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    input: {
      minHeight: MIN_HEIGHT,
      borderWidth: 2,
      borderColor: theme.color.border.strong,
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
      paddingHorizontal: spacing[1.5] + 2,
    },
  });

interface TextFieldProps extends TextInputProps {
  /** Read by TalkBack. Required: a placeholder disappears once there is text. */
  readonly label: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  return (
    <TextInput
      {...rest}
      accessibilityLabel={label}
      placeholderTextColor={theme.color.text.tertiary}
      style={[styles.input, textStyleFor("body"), { color: theme.color.text.primary }, style]}
    />
  );
}
