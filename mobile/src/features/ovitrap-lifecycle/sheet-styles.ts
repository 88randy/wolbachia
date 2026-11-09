import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";
export const createSheetStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    scrim: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.color.navy,
      opacity: 0.55,
    },
    sheet: {
      maxHeight: "90%",
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing[2],
      gap: spacing[2],
    },
    content: { gap: spacing[1], paddingBottom: spacing[2] },
  });
