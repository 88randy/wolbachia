import { useT } from "../../i18n/I18nProvider.tsx";
import { noticeFor } from "../../sync/inbox-notice.ts";
import type { SyncSnapshot } from "../../sync/sync-snapshot.ts";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

const TONE = { info: "info", warning: "warning", critical: "danger" } as const;

/** Why sending is paused, or that there is no signal; renders nothing when all is well. */
export function InboxNoticeBanner({ snapshot }: { readonly snapshot: SyncSnapshot }) {
  const t = useT();
  const notice = noticeFor(snapshot);
  if (notice === null) return null;
  return <InfoNotice tone={TONE[notice.tone]} message={t(notice.messageKey)} />;
}
