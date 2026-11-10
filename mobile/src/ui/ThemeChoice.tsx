import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";

import type { ThemePreference } from "../app/preferences.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    choice: {
      minHeight: spacing[6],
      justifyContent: "center",
      padding: spacing[1.5],
      borderWidth: 2,
      borderRadius: radius.inner,
      borderColor: theme.color.border.default,
    },
    selected: { borderColor: theme.color.actionStrong, backgroundColor: theme.color.tint },
  });

export function ThemeChoice({
  choice,
  isSelected,
  onPress,
}: {
  readonly choice: ThemePreference;
  readonly isSelected: boolean;
  readonly onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={[styles.choice, isSelected ? styles.selected : null]}
    >
      <AppText variant="bodyStrong">{t(`mobile.preview.${choice}`)}</AppText>
    </Pressable>
  );
}
