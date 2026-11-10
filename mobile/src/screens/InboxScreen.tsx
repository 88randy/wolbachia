import { RotateCw } from "lucide-react-native";
import { useLocale, useT } from "../i18n/I18nProvider.tsx";
import { useOutboxAction } from "../outbox/use-outbox-action.ts";
import { formatInboxTime } from "../sync/format-time.ts";
import { useInbox } from "../sync/use-inbox.ts";
import { useSyncEngine, useSyncSnapshot } from "../sync/use-sync.ts";
import { AppHeader } from "../ui/AppHeader.tsx";
import { InfoNotice } from "../ui/InfoNotice.tsx";
import { PrimaryButton } from "../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../ui/ScreenScaffold.tsx";
import { EvidenceNotice } from "./inbox/EvidenceNotice.tsx";
import { InboxLists } from "./inbox/InboxLists.tsx";
import { InboxNoticeBanner } from "./inbox/InboxNoticeBanner.tsx";

function useInboxRetry() {
  const engine = useSyncEngine();
  return useOutboxAction(() => engine.retryNow());
}

/** P28, "Mis envíos". It opens from the top-bar chip and never offers to delete anything. */
export function InboxScreen() {
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
    <ScreenScaffold
      header={<AppHeader title={t("mobile.inbox.title")} subtitle={subtitle} showSync={false} />}
      footer={<PrimaryButton icon={RotateCw} label={t("mobile.inbox.tryNow")} onPress={run} />}
    >
      {errorKey !== null && <InfoNotice tone="danger" message={t(errorKey)} />}
      <InboxNoticeBanner snapshot={snapshot} />
      <EvidenceNotice />
      <InboxLists model={model} />
    </ScreenScaffold>
  );
}
