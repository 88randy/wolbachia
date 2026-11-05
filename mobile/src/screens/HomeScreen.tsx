import { P3Screen } from "../features/shift-open/P3Screen.tsx";
import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useServices } from "../app/services-context.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { Notice } from "../ui/Notice.tsx";
import { TopBar } from "../ui/TopBar.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { flex: 1, gap: spacing[2] },
  });

/** Shell shared with login; M-04 owns the no-shift and local-shift content. */
export function HomeScreen() {
  const styles = useStyles(createStyles);
  const t = useT();
  const { server } = useServices();
  return (
    <View style={styles.root}>
      <TopBar title={t("mobile.home.title")} />
      <View style={styles.content}>
        {server.baseUrl() === null ? (
          <Notice tone="warning" icon="alert" message={t("mobile.home.serverMissing")} />
        ) : null}
        <P3Screen />
      </View>
    </View>
  );
}
