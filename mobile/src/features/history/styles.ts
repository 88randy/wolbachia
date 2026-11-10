import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createHistoryStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], paddingBottom: spacing[6] },
    section: { gap: spacing[1.5] },
    muted: { color: theme.color.text.secondary },
  });
