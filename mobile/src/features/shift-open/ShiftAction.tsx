import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    action: {
      minHeight: 56,
      padding: spacing[1.5],
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: theme.color.action,
      backgroundColor: theme.color.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    selected: { backgroundColor: theme.color.status.info.bg },
    disabled: {
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.disabled.background,
    },
  });
interface Props {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
}
/** Explicit action label/state for TalkBack, with wrapping text and a 56 dp minimum target. */
export function ShiftAction({ label, onPress, disabled = false, selected }: Props) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, selected ? styles.selected : null, disabled ? styles.disabled : null]}
    >
      <AppText variant="button">{label}</AppText>
    </Pressable>
  );
}
