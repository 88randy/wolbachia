import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_TOOLS_ENABLED } from "../config/build-config.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../ui/ScreenHeader.tsx";
import { DarkModeRow } from "./settings/DarkModeRow.tsx";
import { DevToolsSection } from "./settings/DevToolsSection.tsx";
import { LanguageRow } from "./settings/LanguageRow.tsx";
import { ServerSection } from "./settings/ServerSection.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2] },
  });

/** Settings (P31, partial): the pieces this issue needs. The rest of P31 belongs to #11. */
export function SettingsScreen() {
  const styles = useStyles(createStyles);
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScreenHeader title={t("mobile.settings.title")} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[2] }]}
      >
        <LanguageRow />
        <DarkModeRow />
        <ServerSection />
        {DEV_TOOLS_ENABLED ? <DevToolsSection /> : null}
      </ScrollView>
    </View>
  );
}
