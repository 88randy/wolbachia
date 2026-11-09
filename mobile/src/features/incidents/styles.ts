import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";
const emergencyStyles = (theme: Theme) =>
  StyleSheet.create({
    emergency: {
      minHeight: spacing[6] * 3,
      padding: spacing[3],
      gap: spacing[2],
      justifyContent: "center",
      alignItems: "center",
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: theme.color.status.critical.fg,
      backgroundColor: theme.color.status.critical.bg,
    },
    emergencyLabel: { color: theme.color.status.critical.fg, textAlign: "center" },
    disabled: { opacity: 0.6 },
  });
const sheetStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetRoot: { flex: 1, justifyContent: "flex-end" },
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
      padding: spacing[2],
      gap: spacing[2],
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
  });
export const createIncidentStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2], flexGrow: 1 },
    group: { gap: spacing[1] },
    photo: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: radius.inner,
      backgroundColor: theme.color.surfaceMuted,
    },
    ...emergencyStyles(theme),
    ...sheetStyles(theme),
  });
