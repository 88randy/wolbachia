import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createMapStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    map: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", padding: spacing[3], gap: spacing[2] },
    marker: {
      minHeight: 56,
      minWidth: 56,
      padding: spacing[1],
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
      gap: spacing[0.5],
    },
    zoneLabel: {
      paddingHorizontal: spacing[1],
      paddingVertical: spacing[0.5],
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
    },
    footer: { padding: spacing[2], gap: spacing[1], backgroundColor: theme.color.surface },
    attribution: { padding: spacing[0.5], backgroundColor: theme.color.surface },
  });
