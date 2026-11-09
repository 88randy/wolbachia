import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { AppText } from "./AppText.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-paths.ts";

const styles = StyleSheet.create({
  content: { flexDirection: "row", alignItems: "center", gap: spacing[1], maxWidth: "100%" },
  label: { flexShrink: 1, textAlign: "center" },
});

export function ButtonContent({
  icon,
  color,
  label,
}: {
  readonly icon?: IconName;
  readonly color: string;
  readonly label: string;
}) {
  return (
    <View style={styles.content}>
      {icon === undefined ? null : <Icon name={icon} color={color} />}
      <AppText variant="button" style={[styles.label, { color }]}>
        {label}
      </AppText>
    </View>
  );
}
