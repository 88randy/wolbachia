import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../i18n/I18nProvider.tsx";
import { formatClock } from "../sync/format-time.ts";
import { useInbox } from "../sync/use-inbox.ts";
import { useSyncEngine, useSyncSnapshot } from "../sync/use-sync.ts";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { Button } from "../ui/Button.tsx";
import { ScreenHeader } from "../ui/ScreenHeader.tsx";
import { InboxLists } from "./inbox/InboxLists.tsx";
import { InboxNoticeBanner } from "./inbox/InboxNoticeBanner.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
    content: { padding: spacing[2], gap: spacing[2] },
    footer: {
      paddingHorizontal: spacing[2],
      paddingTop: spacing[1.5],
      backgroundColor: theme.color.surface,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
  });

/** P28, the sync inbox. It opens from the top-bar chip and never offers to delete anything. */
export function InboxScreen() {
  const styles = useStyles(createStyles);
  const t = useT();
  const snapshot = useSyncSnapshot();
  const engine = useSyncEngine();
  const model = useInbox();
  const insets = useSafeAreaInsets();
  const subtitle =
    snapshot.lastSyncAt === null
      ? t("mobile.inbox.neverConnected")
      : t("mobile.inbox.lastConnection", { time: formatClock(snapshot.lastSyncAt) });
  return (
    <View style={styles.root}>
      <ScreenHeader title={t("mobile.inbox.title")} subtitle={subtitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <InboxNoticeBanner snapshot={snapshot} />
        <InboxLists model={model} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[2.5] }]}>
        <Button
          icon="refresh"
          label={t("mobile.inbox.tryNow")}
          onPress={() => {
            void engine.retryNow();
          }}
        />
      </View>
    </View>
  );
}
