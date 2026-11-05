import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../i18n/I18nProvider.tsx";
import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { ON_CHROME_COLOR } from "../theme/on-chrome.ts";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { IconButton } from "./IconButton.tsx";
import { SyncChip } from "./SyncChip.tsx";

const BAR_MIN_HEIGHT = 64;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      backgroundColor: theme.color.chrome,
      minHeight: BAR_MIN_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[1],
      paddingBottom: spacing[1],
      paddingLeft: spacing[2],
      paddingRight: spacing[1],
    },
    title: { flex: 1 },
  });

/** The navy top bar of the main screens: title, the sync chip and the way to Settings. */
export function TopBar({ title }: { readonly title: string }) {
  const styles = useStyles(createStyles);
  const t = useT();
  const { push } = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing[1] }]}>
      <View style={styles.title}>
        <AppText variant="button" tone="onChrome" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      <SyncChip />
      <IconButton
        icon="settings"
        label={t("mobile.nav.settings")}
        color={ON_CHROME_COLOR}
        onPress={() => {
          push({ name: "settings" });
        }}
      />
    </View>
  );
}
