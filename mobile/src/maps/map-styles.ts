/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): map measurements, split after the demo. */
import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

export const createMapStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    map: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", padding: spacing[3], gap: spacing[2] },
    marker: {
      minHeight: 32,
      minWidth: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing[1],
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.color.border.strong,
      backgroundColor: theme.color.surface,
    },
    markerSelected: { borderWidth: 3, borderColor: theme.color.action },
    footerCard: { gap: spacing[1] },
    zoneLabel: {
      paddingHorizontal: spacing[1],
      paddingVertical: spacing[0.5],
      borderRadius: radius.md,
      backgroundColor: theme.color.surface,
    },
    footer: { padding: spacing[2], gap: spacing[1], backgroundColor: theme.color.surface },
    canvas: { flex: 1 },
    /** Small corner overlay: the ODbL credit stays visible without taking a row under the map. */
    attribution: {
      position: "absolute",
      right: spacing[0.5],
      bottom: spacing[0.5],
      paddingHorizontal: spacing[0.5],
      borderRadius: radius.sm,
      backgroundColor: theme.color.surface,
      opacity: 0.85,
    },
    attributionText: { fontSize: 11, lineHeight: 14, color: theme.color.text.secondary },
  });
