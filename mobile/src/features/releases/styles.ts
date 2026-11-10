import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createReleaseStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    reference: { gap: spacing[0.5] },
    photo: {
      width: "100%",
      aspectRatio: 1,
      minHeight: spacing[6] * 2,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surfaceMuted,
    },
  });
