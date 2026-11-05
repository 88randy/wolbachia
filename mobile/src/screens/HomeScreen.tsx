import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useServices } from "../app/services-context.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { Card } from "../ui/Card.tsx";
import { Notice } from "../ui/Notice.tsx";
import { TopBar } from "../ui/TopBar.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2] },
  });

/**
 * Placeholder home. The shift screens (P3 onward) replace it in the field-shift epic (#8); this
 * issue only needs a main screen to hold the top bar and its sync chip.
 */
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
        <Card>
          <AppText>{t("mobile.home.placeholder")}</AppText>
        </Card>
      </View>
    </View>
  );
}
