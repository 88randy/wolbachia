import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, TextInput } from "react-native";
import type { TextInputProps } from "react-native";

import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { textStyleFor } from "../theme/typography.ts";
import { useFieldFocus } from "./use-field-focus.ts";

/** Design: inputs are at least 56 dp high with a 2 dp border (`.in`). */
const MIN_HEIGHT = 56;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    input: {
      minHeight: MIN_HEIGHT,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surface,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1.5],
    },
  });

interface TextFieldProps extends TextInputProps {
  /** Read by TalkBack. Required: a placeholder disappears once there is text. */
  readonly label: string;
  readonly isMonospace?: boolean;
}

function useFieldPresentation(props: TextFieldProps) {
  const styles = useStyles(createStyles);
  const { theme, textScale } = useTheme();
  const focus = useFieldFocus(props);
  const hasNumericKeyboard = ["numeric", "number-pad", "decimal-pad"].includes(
    props.keyboardType ?? "",
  );
  return {
    onFocus: focus.onFocus,
    onBlur: focus.onBlur,
    placeholderTextColor: theme.color.text.tertiary,
    style: [
      styles.input,
      textStyleFor("body", props.isMonospace === true || hasNumericKeyboard, textScale),
      { color: theme.color.text.primary },
      props.style,
      focus.isFocused ? { borderColor: theme.color.actionStrong } : null,
    ],
  };
}

export function TextField({ label, isMonospace = false, ...rest }: TextFieldProps) {
  const presentation = useFieldPresentation({ ...rest, label, isMonospace });
  return <TextInput {...rest} {...presentation} accessibilityLabel={label} />;
}
