import { radius, shadow, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { useStyles } from "../theme/ThemeProvider.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.border.soft,
      borderRadius: radius.card,
      padding: spacing[2],
      gap: spacing[1.5],
      shadowColor: shadow.card.color,
      shadowOffset: { width: shadow.card.offsetX, height: shadow.card.offsetY },
      shadowRadius: shadow.card.blur,
      shadowOpacity: 1,
      elevation: shadow.level1.offsetY,
    },
    critical: { borderColor: theme.color.status.critical.fg },
  });

interface CardProps {
  /** A card about something that went wrong has a red border (and a badge: never color alone). */
  readonly isCritical?: boolean;
  readonly children: ReactNode;
}

export function Card({ isCritical = false, children }: CardProps) {
  const styles = useStyles(createStyles);
  return <View style={[styles.card, isCritical ? styles.critical : null]}>{children}</View>;
}
