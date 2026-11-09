import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { gap: spacing[2] },
    block: { minHeight: spacing[6], backgroundColor: theme.color.disabled.background },
  });
export function LifecycleLoading() {
  const t = useT();
  const styles = useStyles(createStyles);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={t("mobile.lifecycle.loading")}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.block} />
      <View style={styles.block} />
      <View style={styles.block} />
    </View>
  );
}
