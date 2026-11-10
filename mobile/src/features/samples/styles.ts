import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createSampleStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    choice: {
      minHeight: spacing[6] + spacing[1],
      justifyContent: "center",
      padding: spacing[1.5],
      gap: spacing[1],
      borderWidth: 2,
      borderRadius: radius.inner,
      borderColor: theme.color.border.default,
    },
    selected: { borderColor: theme.color.actionStrong, backgroundColor: theme.color.tint },
    photo: {
      width: "100%",
      aspectRatio: 1,
      minHeight: spacing[6] * 2,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surfaceMuted,
    },
  });
