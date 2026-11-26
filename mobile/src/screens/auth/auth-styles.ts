import type { Theme } from "@wolbachia/tokens";
import { radius, spacing } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

/** Shared P1/P2 surfaces; dimensions follow the S01 board. */
export const createAuthStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { flexGrow: 1, padding: spacing[2], paddingTop: spacing[4], gap: spacing[2] },
    footer: {
      padding: spacing[2],
      gap: spacing[1],
      backgroundColor: theme.color.surface,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.soft,
    },
    ...createAuthFieldStyles(theme),
    field: { gap: spacing[1] },
    spacer: { flex: 1 },
    centered: { textAlign: "center" },
    password: { gap: spacing[1] },
  });

function createAuthFieldStyles(theme: Theme) {
  return StyleSheet.create({
    passwordFrame: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.color.border.strong,
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
    },
    passwordInput: { flex: 1, minWidth: 0, borderWidth: 0 },
    passwordInputBox: { flex: 1, minWidth: 0 },
    passwordToggle: { flexShrink: 0, paddingRight: spacing[1] },
    errorText: { color: theme.color.status.critical.fg },
    invalidField: { borderColor: theme.color.status.critical.fg },
  });
}
