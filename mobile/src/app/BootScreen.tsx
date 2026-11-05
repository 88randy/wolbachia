import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing[3],
      backgroundColor: theme.color.background,
    },
  });

/** Shown while the phone's storage opens, or when it could not be opened. */
export function BootScreen({ hasFailed }: { readonly hasFailed: boolean }) {
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <View style={styles.root}>
      <AppText variant="h2" accessibilityRole="alert">
        {hasFailed ? t("mobile.boot.storageFailed") : t("mobile.boot.loading")}
      </AppText>
    </View>
  );
}
