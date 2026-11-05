import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles, useTheme } from "../../theme/ThemeProvider.tsx";
import { Icon } from "../../ui/Icon.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { pressPinKey } from "./pin-keypad-model.ts";
import type { PinKeypadProps } from "./pin-keypad-model.ts";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    key: {
      flex: 1,
      minHeight: 64,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing[1],
    },
  });

interface PinKeyProps {
  readonly value: number;
  readonly actions: PinKeypadProps;
}
export function PinKey({ value, actions }: PinKeyProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  const t = useT();
  const label = value >= 0 ? String(value) : t(pinKeyLabel(value));
  const isHidden = value === -1 && !actions.canUseBiometrics;
  return (
    <Pressable
      style={styles.key}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityElementsHidden={isHidden}
      importantForAccessibility={isHidden ? "no-hide-descendants" : "auto"}
      disabled={actions.isBusy || isHidden}
      onPress={() => {
        pressPinKey(value, actions);
      }}
    >
      {value >= 0 ? (
        <AppText variant="h2">{label}</AppText>
      ) : (
        !isHidden && (
          <Icon name={value === -1 ? "fingerprint" : "left"} color={theme.color.text.primary} />
        )
      )}
    </Pressable>
  );
}

function pinKeyLabel(value: number) {
  return value === -1 ? ("mobile.unlock.biometric" as const) : ("mobile.unlock.erase" as const);
}
