import { spacing, radius } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";
import { createSkeletonStyles } from "./skeleton-styles.ts";

export const createDayStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    toggle: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[1],
      padding: spacing[1],
      backgroundColor: theme.color.surface,
    },
    map: { flex: 1 },
    ...createSkeletonStyles(theme),
    card: { minHeight: 56, padding: spacing[1], gap: spacing[1] },
    footer: { padding: spacing[1], gap: spacing[1], backgroundColor: theme.color.surface },
    marker: {
      minHeight: 56,
      minWidth: 56,
      padding: spacing[1],
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
      gap: spacing[0.5],
    },
    attribution: { padding: spacing[0.5], backgroundColor: theme.color.surface },
  });
