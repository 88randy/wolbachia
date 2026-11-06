import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createSkeletonStyles = (theme: Theme) =>
  StyleSheet.create({
    skeletonCode: {
      width: "35%",
      height: spacing[3],
      borderRadius: radius.sm,
      backgroundColor: theme.color.border.default,
    },
    skeletonLine: {
      width: "85%",
      height: spacing[2],
      borderRadius: radius.sm,
      backgroundColor: theme.color.border.default,
    },
    skeletonBadge: {
      width: "55%",
      height: spacing[4],
      borderRadius: radius.md,
      backgroundColor: theme.color.border.default,
    },
    mapSkeleton: { flex: 1, gap: spacing[2], padding: spacing[2] },
    mapPlaceholder: {
      flex: 1,
      borderRadius: radius.md,
      backgroundColor: theme.color.border.default,
    },
  });
