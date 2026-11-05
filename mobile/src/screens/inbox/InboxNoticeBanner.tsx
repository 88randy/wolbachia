import { useT } from "../../i18n/I18nProvider.tsx";
import { noticeFor } from "../../sync/inbox-notice.ts";
import type { SyncSnapshot } from "../../sync/sync-snapshot.ts";
import { Notice } from "../../ui/Notice.tsx";

const ICON_BY_TONE = { info: "refresh", warning: "noSignal", critical: "alert" } as const;

/** Why sending is paused, or that there is no signal; renders nothing when all is well. */
export function InboxNoticeBanner({ snapshot }: { readonly snapshot: SyncSnapshot }) {
  const t = useT();
  const notice = noticeFor(snapshot);
  if (notice === null) return null;
  return (
    <Notice tone={notice.tone} icon={ICON_BY_TONE[notice.tone]} message={t(notice.messageKey)} />
  );
}
