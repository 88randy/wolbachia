import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createFuelStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    switch: {
      minHeight: spacing[6],
      padding: spacing[1.5],
      gap: spacing[1],
      borderWidth: 2,
      borderColor: theme.color.action,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surface,
    },
    selected: { backgroundColor: theme.color.status.info.bg },
    disabled: {
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.disabled.background,
    },
    photo: {
      width: "100%",
      aspectRatio: 1,
      minHeight: spacing[6] * 2,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surfaceMuted,
    },
  });
