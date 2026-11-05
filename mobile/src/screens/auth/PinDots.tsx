import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { PIN_LENGTH } from "../../auth/pin-rules.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    dots: { flexDirection: "row", gap: spacing[2], justifyContent: "center" },
    dot: {
      width: spacing[2],
      height: spacing[2],
      borderRadius: spacing[1],
      borderWidth: 2,
      borderColor: theme.color.text.primary,
    },
    filled: { backgroundColor: theme.color.text.primary },
    error: { borderColor: theme.color.status.critical.fg },
    errorFilled: { backgroundColor: theme.color.status.critical.fg },
  });

export function PinDots({
  length,
  hasError,
}: {
  readonly length: number;
  readonly hasError: boolean;
}) {
  const styles = useStyles(createStyles);
  const t = useT();
  const displayLength = hasError && length === 0 ? PIN_LENGTH : length;
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={t("mobile.unlock.pinProgress", { count: displayLength })}
    >
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < displayLength && styles.filled,
            hasError && styles.error,
            hasError && index < displayLength && styles.errorFilled,
          ]}
        />
      ))}
    </View>
  );
}
