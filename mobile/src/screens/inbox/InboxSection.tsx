import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { AppText } from "../../ui/AppText.tsx";

const styles = StyleSheet.create({ section: { gap: spacing[1] } });

/** A titled block of the inbox ("Con problema", "En el teléfono · 12", ...). */
export function InboxSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" tone="secondary" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}
