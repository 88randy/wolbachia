import { AppScrollView } from "../ui/AppScrollView.tsx";
import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import { BottomActions } from "../ui/BottomActions.tsx";

import { useLocale, useT } from "../i18n/I18nProvider.tsx";
import { useOutboxAction } from "../outbox/use-outbox-action.ts";
import { Notice } from "../ui/Notice.tsx";
import { formatInboxTime } from "../sync/format-time.ts";
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
  });

function useInboxRetry() {
  const engine = useSyncEngine();
  return useOutboxAction(() => engine.retryNow());
}

/** P28, the sync inbox. It opens from the top-bar chip and never offers to delete anything. */
export function InboxScreen() {
  const styles = useStyles(createStyles);
  const t = useT();
  const locale = useLocale();
  const snapshot = useSyncSnapshot();
  const { run, errorKey } = useInboxRetry();
  const model = useInbox();
  const subtitle =
    snapshot.lastSyncAt === null
      ? t("mobile.inbox.neverConnected")
      : t("mobile.inbox.lastConnection", {
          time: formatInboxTime(snapshot.lastSyncAt, { locale }),
        });
  return (
    <View style={styles.root}>
      <ScreenHeader title={t("mobile.inbox.title")} subtitle={subtitle} />
      <AppScrollView contentContainerStyle={styles.content}>
        {errorKey !== null && <Notice tone="critical" icon="alert" message={t(errorKey)} />}
        <InboxNoticeBanner snapshot={snapshot} />
        <InboxLists model={model} />
      </AppScrollView>
      <BottomActions>
        <Button icon="refresh" label={t("mobile.inbox.tryNow")} onPress={run} />
      </BottomActions>
    </View>
  );
}
