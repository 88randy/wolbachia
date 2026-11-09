import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createReceiptStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    footer: {
      padding: spacing[2],
      gap: spacing[1],
      backgroundColor: theme.color.surface,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    skeleton: {
      minHeight: spacing[6] * 2,
      borderRadius: radius.lg,
      backgroundColor: theme.color.disabled.background,
    },
  });
